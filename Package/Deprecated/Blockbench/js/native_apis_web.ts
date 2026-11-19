/**
 * Blockbench native apis web.
 *
 * @module @bedform/blockbench/js/native_apis_web
 *
 * @file      native_apis_web.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   GPL-3.0-or-later
 */

// Dummy exports for native APIs when running on web

const NULL = null;
/** @internal */
export {
	NULL as electron,
	NULL as clipboard,
	NULL as shell,
	NULL as nativeImage,
	NULL as ipcRenderer,
	NULL as webUtils,
	NULL as app,
	NULL as fs,
	NULL as NodeBuffer,
	NULL as zlib,
	NULL as child_process,
	NULL as https,
	NULL as PathModule,
	NULL as os,
	NULL as currentwindow,
	NULL as dialog,
	NULL as openFileInEditor,
	NULL as getPluginScopedRequire,
	NULL as process,
	NULL as SystemInfo,
	NULL as revokePluginPermissions,
	NULL as exposeNativeApisInDevTools,
}

/**
 * @internal
 */
export function getPCUsername() {
	return '';
}

window.SystemInfo = null;
