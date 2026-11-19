/**
 * Blockbench edit for modeling.
 *
 * @module @bedform/blockbench/js/modeling/edit
 *
 * @file      edit.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   GPL-3.0-or-later
 */

import { Mode } from "../modes";

BARS.defineActions(function() {
	new Mode('edit', {
		icon: 'deployed_code',
		default_tool: 'move_tool',
		category: 'navigate',
		condition: () => Format && Format.edit_mode,
		onSelect: () => {
			Outliner.elements.forEach(cube => {
				// @ts-ignore
				if (cube.preview_controller.updatePixelGrid) cube.preview_controller.updatePixelGrid(cube);
			})
		},
		onUnselect: () => {
			if (Undo) Undo.closeAmendEditMenu();
			Outliner.elements.forEach(cube => {
				// @ts-ignore
				if (cube.preview_controller.updatePixelGrid) cube.preview_controller.updatePixelGrid(cube);
			})
		}
	})
})
