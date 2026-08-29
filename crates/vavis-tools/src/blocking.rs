//! Running async work from inside a synchronous tool.
//!
//! Tools are synchronous: [`Tool::run`](crate::Tool::run) returns a value
//! rather than a future, which keeps the trait object simple. Most of them
//! still need to make a network call, and every one of those has to get from
//! sync code into an async client somehow.
//!
//! The obvious way is wrong. Building a fresh runtime and calling `block_on`
//! works when the caller is an ordinary thread, and **panics** when it is a
//! thread already driving a Tokio runtime:
//!
//! ```text
//! Cannot start a runtime from within a runtime.
//! ```
//!
//! That is exactly the shape of this program. The shell spawns a thread, gives
//! it a current-thread runtime, and `block_on`s the agent turn; the agent loop
//! is async and calls `tool.run()` from inside it. So every network tool ran on
//! a runtime thread and panicked the moment the model actually called one --
//! killing the worker, so the request never completed and no reply ever
//! arrived. The `Tool` docs claimed tools "delegate blocking work to
//! `spawn_blocking`", but nothing ever did.
//!
//! [`run_async`] is the one correct way to do it, and every tool uses it.

use std::future::Future;

/// Runs a future to completion from synchronous code.
///
/// Works whether or not the caller is already on a runtime thread:
///
/// * **On a runtime thread** — hands the current thread back to the scheduler
///   with `block_in_place` before blocking on it, so other tasks keep running
///   and Tokio does not object. This needs the multi-threaded runtime;
///   `block_in_place` panics on a current-thread one, which is why the fallback
///   below exists rather than being unreachable.
/// * **Off a runtime thread, or on a current-thread runtime** — builds a
///   short-lived runtime, which is safe because there is no scheduler on this
///   thread to starve.
///
/// The returned error is a string because every caller turns it into a tool
/// error message anyway.
///
/// `Send` is required on both the future and its output because the fallback
/// path moves the work to a scratch thread. Every caller here is an HTTP
/// request, which satisfies it.
pub fn run_async<F>(future: F) -> Result<F::Output, String>
where
    F: Future + Send,
    F::Output: Send,
{
    match tokio::runtime::Handle::try_current() {
        Ok(handle) if handle.runtime_flavor() == tokio::runtime::RuntimeFlavor::MultiThread => {
            Ok(tokio::task::block_in_place(|| handle.block_on(future)))
        }
        // Either no runtime at all, or a current-thread one. In both cases a
        // nested runtime on a *new* thread is the only option: `block_on` on
        // this thread would panic, and `block_in_place` is not available on a
        // current-thread runtime.
        //
        // The future is moved to a scratch thread with its own runtime, and
        // this thread simply waits for it. That costs a thread per call, which
        // is acceptable for tool calls: they are user-initiated, at most a
        // handful per turn, and already dominated by network latency.
        _ => std::thread::scope(|scope| {
            scope
                .spawn(|| {
                    let runtime = tokio::runtime::Builder::new_current_thread()
                        .enable_all()
                        .build()
                        .map_err(|e| e.to_string())?;
                    Ok(runtime.block_on(future))
                })
                .join()
                .map_err(|_| "async work panicked".to_string())?
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The plain case: no runtime anywhere.
    #[test]
    fn runs_without_a_runtime() {
        let value = run_async(async { 6 * 7 }).expect("should run");
        assert_eq!(value, 42);
    }

    /// The case that used to panic and take a whole request with it: a tool
    /// called from inside a current-thread runtime, which is precisely how the
    /// shell drives an agent turn.
    #[test]
    fn runs_inside_a_current_thread_runtime() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime");

        let value = runtime.block_on(async {
            // Synchronous call from async context -- what `tool.run()` is.
            run_async(async { 6 * 7 }).expect("should run")
        });

        assert_eq!(value, 42);
    }

    /// The same, on a multi-threaded runtime, which takes the other branch.
    #[test]
    fn runs_inside_a_multi_thread_runtime() {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("runtime");

        let value = runtime.block_on(async { run_async(async { 6 * 7 }).expect("should run") });

        assert_eq!(value, 42);
    }

    /// Pins down what was actually wrong, so the helper above is not just
    /// assumed to be necessary.
    ///
    /// This is the pattern every network tool used before `run_async`: build a
    /// runtime, block on it. From inside another runtime it panics, and that
    /// panic is what killed the request thread and left the user waiting for a
    /// reply that never came.
    #[test]
    fn the_old_pattern_panics_inside_a_runtime() {
        let outer = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime");

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            outer.block_on(async {
                let inner = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .expect("runtime");
                inner.block_on(async { 42 })
            })
        }));

        assert!(
            result.is_err(),
            "nesting block_on should panic -- if this ever stops being true, \
             run_async's fallback path can be simplified"
        );
    }

    /// Awaiting real async work, not just a ready value: a future that yields
    /// has to be driven by a scheduler, so this catches a helper that only
    /// happens to work for futures completing on first poll.
    #[test]
    fn drives_a_future_that_yields() {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime");

        let value = runtime.block_on(async {
            run_async(async {
                tokio::task::yield_now().await;
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
                "done"
            })
            .expect("should run")
        });

        assert_eq!(value, "done");
    }
}
