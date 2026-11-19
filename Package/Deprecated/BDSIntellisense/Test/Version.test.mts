/**
 * Parsing, formatting and ordering of BDS release numbers.
 *
 * @module bds-intellisense/Test/Version.test
 *
 * @file      Version.test.mts
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import Assert from "node:assert/strict";
import { Version } from "bds-intellisense";
import { test } from "node:test";

test("Parse accepts two to four numeric parts and trims whitespace", () =>
{
    Assert.deepEqual(Version.Parse("1.26"), [ 1, 26 ]);
    Assert.deepEqual(Version.Parse(" 1.26.63.1 "), [ 1, 26, 63, 1 ]);
    Assert.deepEqual(Version.Parse("1.16.0"), [ 1, 16, 0 ]);
});

test("Parse rejects anything that is not a dotted release number", () =>
{
    for (const text of [ "", "1", "1.2.3.4.5", "latest", "1.26.x", "v1.26.0", "1..2", "-1.2" ])
    {
        Assert.equal(Version.Parse(text), undefined, text);
    }
});

test("Format keeps every part", () =>
{
    Assert.equal(Version.Format([ 1, 26, 63, 1 ]), "1.26.63.1");
    Assert.equal(Version.Format([ 1, 20 ]), "1.20");
});

test("Compare orders numerically and treats missing parts as zero", () =>
{
    Assert.equal(Version.Compare([ 1, 9 ], [ 1, 10 ]), -1);
    Assert.equal(Version.Compare([ 1, 26, 63, 1 ], [ 1, 26, 63 ]), 1);
    Assert.equal(Version.Compare([ 1, 26 ], [ 1, 26, 0, 0 ]), 0);
    Assert.ok(Version.Equals([ 1, 20, 0 ], [ 1, 20 ]));
    Assert.ok(!Version.Equals([ 1, 20, 1 ], [ 1, 20 ]));
});

test("Latest picks the newest version and is undefined for none", () =>
{
    Assert.deepEqual(Version.Latest([ [ 1, 16, 0 ], [ 1, 26, 63, 1 ], [ 1, 21, 0 ] ]), [ 1, 26, 63, 1 ]);
    Assert.equal(Version.Latest([]), undefined);
});
