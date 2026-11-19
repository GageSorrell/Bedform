/**
 * Blockbench shader for shaders.
 *
 * @module @bedform/blockbench/js/shaders/shader
 *
 * @file      shader.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   GPL-3.0-or-later
 */

$1$2
$1{
	if (settings.antialiasing_bleed_fix.value == false || Preview.selected?.renderer.capabilities.isWebGL2 != true) {
		shader = shader.replace(/centroid /g, '');
	}
	if (!isApp) {
		shader = shader.replace('precision highp', 'precision mediump');
	}
	return shader;
}
