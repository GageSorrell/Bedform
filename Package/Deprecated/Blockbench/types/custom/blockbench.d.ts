/**
 * Blockbench blockbench API declarations.
 *
 * @module blockbench-types/custom/blockbench
 *
 * @file      blockbench.d.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

/// <reference types="vue" />
/// <reference types="./libs" />
/// <reference types="@types/prismjs" />
/// <reference types="@types/jquery" />
/// <reference types="wintersky" />

/// <reference types="./texture_group" />
/// <reference types="./keybind" />
/// <reference types="./animation" />
/// <reference types="./animation_controller" />
/// <reference types="./canvas_frame" />
/// <reference types="./canvas" />
/// <reference types="./copy_paste" />
/// <reference types="./cube" />
/// <reference types="./desktop" />
/// <reference types="./display_mode" />
/// <reference types="./global" />
/// <reference types="./group" />
$1$2
$1{
	Animation: {
		new (
			effect?: AnimationEffect | null | undefined,
			timeline?: AnimationTimeline | null | undefined
		): Animation
		prototype: Animation
	}
}

/**
 * Shader support
 */
declare module "*.glsl" {
	const value: string;
	export default value;
}
declare module "*.bbtheme" {
	const value: string | any;
	export default value;
}
declare module "*.png"
declare module "*.webp"
declare module "*.jpeg"
