/**
 * Mesh topology and vertex operations for Blockbench modeling.
 *
 * @module @bedform/blockbench/js/modeling/mesh/util
 *
 * @file      util.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   GPL-3.0-or-later
 */

export function sameMeshEdge(edge_a: MeshEdge, edge_b: MeshEdge): boolean {
	return edge_a.equals(edge_b) || (edge_a[0] == edge_b[1] && edge_a[1] == edge_b[0])
}
const global = {
	sameMeshEdge
}
declare global {
	const sameMeshEdge: typeof global.sameMeshEdge
	interface BarItemRegistry
	{
		selection_mode: BarSelect
	}
}
Object.assign(window, global)
