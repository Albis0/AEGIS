/**
 * Spotify tool executors (audit C2) — extracted verbatim from tools.ts.
 * Thin arg-coercion wrappers over spotify.ts; schemas live in tools/schemas.ts.
 */

import {spotifyAuthorizeCmd, spotifyPlay, spotifyPause, spotifyNext, spotifyPrev, spotifySetVolume, spotifyGetState, spotifyOpen, spotifySearchPlay, spotifyListPlaylists, spotifyPlayPlaylist, spotifyLikeTrack, spotifyAddToQueue, spotifyListDevices, spotifyTransferDevice, spotifySetShuffle, spotifySetRepeat, spotifySeek, spotifyGetRecentlyPlayed, spotifyGetQueue, spotifyGetAlbum, spotifyGetAlbumTracks, spotifyGetSavedAlbums, spotifySaveAlbum, spotifyRemoveSavedAlbum, spotifyGetArtist, spotifyGetArtistTopTracks, spotifyGetArtistAlbums, spotifyGetRelatedArtists, spotifyGetTrack, spotifyGetAudioFeatures, spotifyGetRecommendations, spotifyGetPlaylist, spotifyGetPlaylistItems, spotifyCreatePlaylist, spotifyPlaylistAdd, spotifyPlaylistRemove, spotifyGetFeaturedPlaylists, spotifyGetSavedTracks, spotifyCheckSavedTracks, spotifyGetSavedShows, spotifyGetSavedEpisodes, spotifyGetSavedAudiobooks, spotifyGetCurrentUser, spotifyGetTopItems, spotifyFollowArtist, spotifyUnfollowArtist, spotifyGetFollowedArtists, spotifyGetNewReleases, spotifyGetCategories, spotifyGetShow, spotifyGetShowEpisodes, spotifyGetEpisode, spotifyGetAudiobook} from "../spotify";
import type {ToolExecutor} from "./executor-types";

export const spotifyExecutors: Record<string, ToolExecutor> = {
    async spotify_authorize() { return spotifyAuthorizeCmd(); },
    async spotify_play({query}: {query?: unknown} = {}) {
        const q = typeof query === "string" ? query.trim() : "";
        return q ? spotifySearchPlay(q) : spotifyPlay();
    },
    async spotify_pause() { return spotifyPause(); },
    async spotify_next() { return spotifyNext(); },
    async spotify_prev() { return spotifyPrev(); },
    async spotify_volume({level}: {level?: unknown}) { return spotifySetVolume(Number(level ?? 50)); },
    async spotify_now_playing() { return spotifyGetState(); },
    async spotify_open() { return spotifyOpen(); },
    async spotify_search({query}: {query?: unknown}) { return spotifySearchPlay(String(query ?? "")); },
    async spotify_playlists() { return spotifyListPlaylists(); },
    async spotify_play_playlist({name}: {name?: unknown}) { return spotifyPlayPlaylist(String(name ?? "")); },
    async spotify_like() { return spotifyLikeTrack(); },
    async spotify_queue({query}: {query?: unknown}) { return spotifyAddToQueue(String(query ?? "")); },
    async spotify_devices() { return spotifyListDevices(); },
    async spotify_transfer({device}: {device?: unknown}) { return spotifyTransferDevice(String(device ?? "")); },
    async spotify_shuffle({enabled}: {enabled?: unknown}) { return spotifySetShuffle(String(enabled) === "true"); },
    async spotify_repeat({mode}: {mode?: unknown}) { return spotifySetRepeat((mode as "off" | "track" | "context") ?? "off"); },

    // Player extras
    async spotify_seek({position_ms}: {position_ms?: unknown}) { return spotifySeek(Number(position_ms ?? 0)); },
    async spotify_recently_played({limit}: {limit?: unknown}) { return spotifyGetRecentlyPlayed(Number(limit ?? 20)); },
    async spotify_get_queue() { return spotifyGetQueue(); },

    // Albums
    async spotify_get_album({id}: {id?: unknown}) { return spotifyGetAlbum(String(id ?? "")); },
    async spotify_album_tracks({id}: {id?: unknown}) { return spotifyGetAlbumTracks(String(id ?? "")); },
    async spotify_saved_albums({limit}: {limit?: unknown}) { return spotifyGetSavedAlbums(Number(limit ?? 20)); },
    async spotify_save_album({id}: {id?: unknown}) { return spotifySaveAlbum(String(id ?? "")); },
    async spotify_remove_album({id}: {id?: unknown}) { return spotifyRemoveSavedAlbum(String(id ?? "")); },

    // Artists
    async spotify_get_artist({id}: {id?: unknown}) { return spotifyGetArtist(String(id ?? "")); },
    async spotify_artist_top_tracks({id}: {id?: unknown}) { return spotifyGetArtistTopTracks(String(id ?? "")); },
    async spotify_artist_albums({id}: {id?: unknown}) { return spotifyGetArtistAlbums(String(id ?? "")); },
    async spotify_related_artists({id}: {id?: unknown}) { return spotifyGetRelatedArtists(String(id ?? "")); },

    // Tracks
    async spotify_get_track({id}: {id?: unknown}) { return spotifyGetTrack(String(id ?? "")); },
    async spotify_audio_features({id}: {id?: unknown}) { return spotifyGetAudioFeatures(String(id ?? "")); },
    async spotify_recommendations({seed_artists, seed_tracks, seed_genres, limit}: {seed_artists?: unknown; seed_tracks?: unknown; seed_genres?: unknown; limit?: unknown}) {
        return spotifyGetRecommendations({
            seed_artists: seed_artists ? String(seed_artists) : undefined,
            seed_tracks:  seed_tracks  ? String(seed_tracks)  : undefined,
            seed_genres:  seed_genres  ? String(seed_genres)  : undefined,
            limit: limit ? Number(limit) : undefined,
        });
    },

    // Playlists extended
    async spotify_get_playlist({id}: {id?: unknown}) { return spotifyGetPlaylist(String(id ?? "")); },
    async spotify_playlist_tracks({id, limit}: {id?: unknown; limit?: unknown}) { return spotifyGetPlaylistItems(String(id ?? ""), Number(limit ?? 20)); },
    async spotify_create_playlist({name, public: pub, description}: {name?: unknown; public?: unknown; description?: unknown}) {
        return spotifyCreatePlaylist(String(name ?? ""), Boolean(pub), String(description ?? ""));
    },
    async spotify_playlist_add({playlist_id, uris}: {playlist_id?: unknown; uris?: unknown}) {
        return spotifyPlaylistAdd(String(playlist_id ?? ""), Array.isArray(uris) ? uris.map(String) : []);
    },
    async spotify_playlist_remove({playlist_id, uris}: {playlist_id?: unknown; uris?: unknown}) {
        return spotifyPlaylistRemove(String(playlist_id ?? ""), Array.isArray(uris) ? uris.map(String) : []);
    },
    async spotify_featured_playlists() { return spotifyGetFeaturedPlaylists(); },

    // Library
    async spotify_saved_tracks({limit}: {limit?: unknown}) { return spotifyGetSavedTracks(Number(limit ?? 20)); },
    async spotify_check_saved_tracks({ids}: {ids?: unknown}) { return spotifyCheckSavedTracks(Array.isArray(ids) ? ids.map(String) : []); },
    async spotify_saved_shows({limit}: {limit?: unknown}) { return spotifyGetSavedShows(Number(limit ?? 20)); },
    async spotify_saved_episodes({limit}: {limit?: unknown}) { return spotifyGetSavedEpisodes(Number(limit ?? 20)); },
    async spotify_saved_audiobooks({limit}: {limit?: unknown}) { return spotifyGetSavedAudiobooks(Number(limit ?? 20)); },

    // User
    async spotify_me() { return spotifyGetCurrentUser(); },
    async spotify_top_items({type, time_range, limit}: {type?: unknown; time_range?: unknown; limit?: unknown}) {
        return spotifyGetTopItems(
            (type as "artists" | "tracks") ?? "tracks",
            (time_range as "short_term" | "medium_term" | "long_term") ?? "medium_term",
            Number(limit ?? 10),
        );
    },

    // Follow
    async spotify_follow_artist({id}: {id?: unknown}) { return spotifyFollowArtist(String(id ?? "")); },
    async spotify_unfollow_artist({id}: {id?: unknown}) { return spotifyUnfollowArtist(String(id ?? "")); },
    async spotify_followed_artists({limit}: {limit?: unknown}) { return spotifyGetFollowedArtists(Number(limit ?? 20)); },

    // Browse
    async spotify_new_releases({limit}: {limit?: unknown}) { return spotifyGetNewReleases(Number(limit ?? 10)); },
    async spotify_categories({limit}: {limit?: unknown}) { return spotifyGetCategories(Number(limit ?? 20)); },

    // Shows / Episodes / Audiobooks
    async spotify_get_show({id}: {id?: unknown}) { return spotifyGetShow(String(id ?? "")); },
    async spotify_show_episodes({id, limit}: {id?: unknown; limit?: unknown}) { return spotifyGetShowEpisodes(String(id ?? ""), Number(limit ?? 10)); },
    async spotify_get_episode({id}: {id?: unknown}) { return spotifyGetEpisode(String(id ?? "")); },
    async spotify_get_audiobook({id}: {id?: unknown}) { return spotifyGetAudiobook(String(id ?? "")); },
};
