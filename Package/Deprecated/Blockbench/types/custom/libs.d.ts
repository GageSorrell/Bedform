/**
 * Blockbench libs API declarations.
 *
 * @module blockbench-types/custom/libs
 *
 * @file      libs.d.ts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import three from 'three'

declare module 'three' {
	interface Object3D
	{
		/**The outline mesh of the mesh */
		outline?: three.Object3D | three.Mesh
		fix_rotation?: three.Euler
		fix_position?: three.Vector3
		no_export?: boolean
		isElement?: boolean
		isGroup?: boolean
	}
}
