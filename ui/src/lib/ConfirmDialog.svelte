<!--
    The confirmation dialog.

    Mounted once at the root; draws whatever `confirm.svelte.ts` has pending.
    See that file for why the browser's own `confirm()` had to go.

    Two decisions worth keeping:

    **Cancel gets the focus, not the affirmative button.** The dialog exists
    because the action is hard to undo, so the keyboard default has to be the
    harmless answer. Enter still confirms — it is bound at the window, since
    the affirmative button is deliberately not the focused control — but it
    takes a press aimed at this dialog rather than being what happens next if
    the user was already typing.

    **It cannot be dismissed by clicking away.** A question that vanishes when
    the pointer slips leaves the user unsure which answer they gave. Escape
    still cancels, because that one is unambiguous.
-->
<script lang="ts">
    import { confirmStore } from "./confirm.svelte";
    import Modal from "./Modal.svelte";

    const pending = $derived(confirmStore.pending);

    function onWindowKey(event: KeyboardEvent) {
        if (!pending || event.key !== "Enter") return;
        event.preventDefault();
        confirmStore.answer(true);
    }
</script>

<svelte:window onkeydown={onWindowKey} />

{#if pending}
    <Modal
        size="sm"
        title={pending.title}
        dismissable={false}
        showClose={false}
        onClose={() => confirmStore.answer(false)}
    >
        {#if pending.body}
            <p class="body">{pending.body}</p>
        {/if}

        {#snippet footer()}
            <button data-autofocus onclick={() => confirmStore.answer(false)}>
                {pending?.cancelLabel ?? "Cancel"}
            </button>
            <button
                class="primary"
                class:destructive={pending?.danger}
                onclick={() => confirmStore.answer(true)}
            >
                {pending?.confirmLabel ?? "Confirm"}
            </button>
        {/snippet}
    </Modal>
{/if}

<style>
    .body {
        font-size: var(--text-sm);
        color: var(--text-muted);
        line-height: 1.6;
    }

    /* A destructive affirmative is filled with the danger colour rather than
       the accent, so the dangerous answer never looks like the safe default. */
    .destructive {
        background: var(--danger-solid);
        color: #fff;
    }
    .destructive:hover:not(:disabled) {
        background: var(--danger-solid);
        color: #fff;
        filter: brightness(1.1);
    }
</style>
