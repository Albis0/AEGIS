//! Anahtarsız aramanın gerçekten çalıştığını doğrular.
//!
//! Ağa çıktığı için varsayılan olarak atlanıyor: `cargo test -- --ignored`.
//! Buradaki soru birim testin cevaplayamayacağı bir soru — "kullanıcı bir şey
//! arayınca sonuç geliyor mu" — ve bir zamanlar cevap hayırdı: üç sağlayıcının
//! anahtarı yoktu, dördüncüsü de her sorguya boş dönüyordu.

use vavis_tools::websearch;

#[test]
#[ignore = "ağa çıkıyor — cargo test -- --ignored"]
fn a_user_with_no_keys_still_gets_results() {
    // Hiçbir anahtar yok: en kötü durum.
    websearch::configure(websearch::Settings::default());

    let queries = ["istanbul nufusu", "rust programming language", "ankara"];
    let mut worked = 0;

    for query in queries {
        // Arka arkaya istek kısıtlamayı tetikliyor; aralık bırak.
        std::thread::sleep(std::time::Duration::from_secs(3));

        match websearch::search(query, 5) {
            Ok((response, _)) => {
                assert!(
                    !response.hits.is_empty() || response.answer.is_some(),
                    "'{query}' için boş yanıt döndü"
                );
                println!(
                    "'{query}' -> {} ({} sonuç)",
                    response.provider,
                    response.hits.len()
                );
                worked += 1;
            }
            // Kısıtlama bir başarısızlık değil — sağlayıcı çalışıyor ama
            // bizi yavaşlatıyor. Testin ölçtüğü şey bu değil.
            Err(attempts) => println!("'{query}' atlandı: {attempts:?}"),
        }
    }

    assert!(
        worked > 0,
        "anahtarsız kullanıcı hiçbir sorguda sonuç alamadı"
    );
}
