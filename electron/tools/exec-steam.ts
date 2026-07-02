/**
 * Steam tool executors (audit C2) — extracted verbatim from tools.ts.
 * Thin arg-coercion wrappers over steam.ts; schemas live in tools/schemas.ts.
 * NOTE: steam_wishlist_add stays in tools.ts — it drives the computer-use
 * executor + screenshot callbacks that live there.
 */

import {
    steamLaunchGame, steamListGames, steamOpen, steamClose, steamGameRunning,
    steamRestart, steamCloseGame, steamRestartGame, steamListRunningGames, steamIsGameRunning,
    steamInstallGame, steamUninstallGame, steamVerifyGameFiles, steamUpdateGame,
    steamDownloadStatus, steamPauseResumeCancel,
    steamOpenStorePage, steamOpenWorkshop, steamWorkshopSubscribe, steamListWorkshopSubs,
    steamOpenScreenshots, steamShowStorageUsage, steamLocateInstallation, steamOpenGameFolder,
    steamBackupGame, steamRestoreBackup, steamOpenChat, steamSendMessage, steamRepeatLastAction,
    steamWishlistAdd, steamWishlistList, steamTakeScreenshot,
    steamGetOwnedGames, steamSearchOwnedGames, steamGetRecentGames, steamGetMostPlayed,
    steamGetGamePlaytime, steamGetTotalPlaytime, steamSuggestGame,
    steamGetGameAchievements, steamGetAchievementProgress, steamGetPlayerStats,
    steamGetProfileSummary, steamGetLevel, steamGetFriendList, steamGetOnlineFriends,
    steamGetFriendCurrentGame, steamWhoIsPlaying, steamGetLastPlayed,
    steamSearchStore, steamGetGameDetails, steamGetGamePrice, steamGetDiscountedGames, steamGetGameNews,
} from "../steam";
import type {ToolExecutor} from "./executor-types";

export const steamExecutors: Record<string, ToolExecutor> = {
    async steam_launch({game}: {game?: unknown}) { return steamLaunchGame(String(game ?? "")); },
    async steam_list() { return steamListGames(); },
    async steam_open() { return steamOpen(); },
    async steam_close() { return steamClose(); },
    async steam_game_running() { return steamGameRunning(); },
    // Grup A — local/protokol
    async steam_restart() { return steamRestart(); },
    async steam_close_game({game}: {game?: unknown}) { return steamCloseGame(game != null ? String(game) : undefined); },
    async steam_restart_game({game}: {game?: unknown}) { return steamRestartGame(String(game ?? "")); },
    async steam_list_running_games() { return steamListRunningGames(); },
    async steam_is_game_running({game}: {game?: unknown}) { return steamIsGameRunning(String(game ?? "")); },
    async steam_install_game({game}: {game?: unknown}) { return steamInstallGame(String(game ?? "")); },
    async steam_uninstall_game({game}: {game?: unknown}) { return steamUninstallGame(String(game ?? "")); },
    async steam_verify_game_files({game}: {game?: unknown}) { return steamVerifyGameFiles(String(game ?? "")); },
    async steam_update_game({game}: {game?: unknown}) { return steamUpdateGame(String(game ?? "")); },
    async steam_download_status() { return steamDownloadStatus(); },
    async steam_open_store_page({game}: {game?: unknown}) { return steamOpenStorePage(String(game ?? "")); },
    async steam_open_screenshots() { return steamOpenScreenshots(); },
    async steam_show_storage_usage() { return steamShowStorageUsage(); },
    async steam_locate_installation({game}: {game?: unknown}) { return steamLocateInstallation(String(game ?? "")); },
    async steam_open_game_folder({game}: {game?: unknown}) { return steamOpenGameFolder(String(game ?? "")); },
    async steam_last_played_game() { return steamGetLastPlayed(); },
    // Grup C — storefront
    async steam_search_store({query}: {query?: unknown}) { return steamSearchStore(String(query ?? "")); },
    async steam_game_details({game}: {game?: unknown}) { return steamGetGameDetails(String(game ?? "")); },
    async steam_game_price({game}: {game?: unknown}) { return steamGetGamePrice(String(game ?? "")); },
    async steam_discounted_games() { return steamGetDiscountedGames(); },
    async steam_game_news({game}: {game?: unknown}) { return steamGetGameNews(String(game ?? "")); },
    // Grup B — Web API
    async steam_owned_games() { return steamGetOwnedGames(); },
    async steam_search_owned_games({query}: {query?: unknown}) { return steamSearchOwnedGames(String(query ?? "")); },
    async steam_recent_games() { return steamGetRecentGames(); },
    async steam_most_played_games() { return steamGetMostPlayed(); },
    async steam_game_playtime({game}: {game?: unknown}) { return steamGetGamePlaytime(String(game ?? "")); },
    async steam_total_playtime() { return steamGetTotalPlaytime(); },
    async steam_suggest_game() { return steamSuggestGame(); },
    async steam_game_achievements({game}: {game?: unknown}) { return steamGetGameAchievements(String(game ?? "")); },
    async steam_achievement_progress({game}: {game?: unknown}) { return steamGetAchievementProgress(String(game ?? "")); },
    async steam_player_stats({game}: {game?: unknown}) { return steamGetPlayerStats(String(game ?? "")); },
    async steam_profile_summary() { return steamGetProfileSummary(); },
    async steam_level() { return steamGetLevel(); },
    async steam_friend_list() { return steamGetFriendList(); },
    async steam_online_friends() { return steamGetOnlineFriends(); },
    async steam_friend_current_game({friend}: {friend?: unknown}) { return steamGetFriendCurrentGame(String(friend ?? "")); },
    async steam_who_is_playing({game}: {game?: unknown}) { return steamWhoIsPlaying(String(game ?? "")); },
    // Grup D — deneysel
    async steam_wishlist_remove({game}: {game?: unknown}) { return steamWishlistAdd(String(game ?? ""), false); },
    async steam_wishlist_list() { return steamWishlistList(); },
    async steam_pause_download() { return steamPauseResumeCancel("pause"); },
    async steam_resume_download() { return steamPauseResumeCancel("resume"); },
    async steam_cancel_download() { return steamPauseResumeCancel("cancel"); },
    async steam_open_workshop({game}: {game?: unknown}) { return steamOpenWorkshop(game != null ? String(game) : undefined); },
    async steam_subscribe_workshop({item_id}: {item_id?: unknown}) { return steamWorkshopSubscribe(String(item_id ?? ""), true); },
    async steam_unsubscribe_workshop({item_id}: {item_id?: unknown}) { return steamWorkshopSubscribe(String(item_id ?? ""), false); },
    async steam_list_workshop_subscriptions({game}: {game?: unknown}) { return steamListWorkshopSubs(game != null ? String(game) : undefined); },
    async steam_open_chat({friend_id}: {friend_id?: unknown}) { return steamOpenChat(String(friend_id ?? "")); },
    async steam_send_message({friend_id, message}: {friend_id?: unknown; message?: unknown}) { return steamSendMessage(String(friend_id ?? ""), String(message ?? "")); },
    async steam_backup_game({game}: {game?: unknown}) { return steamBackupGame(String(game ?? "")); },
    async steam_restore_backup() { return steamRestoreBackup(); },
    async steam_take_screenshot() { return steamTakeScreenshot(); },
    async steam_repeat_last_action() { return steamRepeatLastAction(); },
};
