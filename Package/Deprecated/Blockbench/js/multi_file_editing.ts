/**
 * Blockbench multi file editing.
 *
 * @module @bedform/blockbench/js/multi_file_editing
 *
 * @file      multi_file_editing.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   GPL-3.0-or-later
 */

export const ScopeColors = [
	'#4642bb',
	'#924919',
	'#237028',
	'#077678',
	'#770c0c',
	'#7a7000',
	'#60179a',
];

interface MultiFileRules
{
	scope_isolated_animations: boolean
	collections_as_files: boolean
}

exportinterface MultiFileRuleset extends MultiFileRules {}
export class MultiFileRuleset {
	id: string

	constructor(id: string, rules: MultiFileRules) {
		this.id = id;
		Object.assign(this, rules);
		MultiFileRuleset.rulesets[id] = this;
	}

	static rulesets: Record<string, MultiFileRuleset> = {};
}


const global = {
	MultiFileRuleset,
}
declare global {
	const MultiFileRuleset: typeof global.MultiFileRuleset
	type MultiFileRuleset = import('./multi_file_editing').MultiFileRuleset
}
Object.assign(window, global);
