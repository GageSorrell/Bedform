/**
 * Blockbench dynamic 2d map.
 *
 * @module @bedform/blockbench/js/util/dynamic_2d_map
 *
 * @file      dynamic_2d_map.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   GPL-3.0-or-later
 */

export class Dynamic2DMap<Type> {
	map: Record<number, Record<number, Type>>
	constructor() {
		this.map = {};
	}
	get(x: number, y: number): Type | undefined {
		return this.map[x]?.[y];
	}
	set(x: number, y: number, value: Type): void {
		if (!this.map[x]) this.map[x] = {};
		this.map[x][y] = value;
	}
	clear() {
		this.map = {};
	}
}
