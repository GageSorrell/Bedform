/**
 * Installed JSX component contracts and an executable spatial widget consumer.
 *
 * @module bedform/Test/SpatialComponents
 *
 * @file      SpatialComponents.tsx
 * @author    Gage Sorrell <gage@sorrell.sh>
 * @copyright (c) 2026 Gage Sorrell
 * @license   MIT
 */

import * as C from "bedform/Spatial/Components";
import type { ReactElement } from "bedform/Spatial/React";

/**
 * Composes all public component families without ambient React or native types.
 *
 * @category Testing
 * @since 1.0.0
 */
export function Sample(): ReactElement
{
    return <C.ThemeProvider theme="dark"
        Tokens={ { FramePadding: 6 } }>
        <C.View Dimension="test:packed"
            Width={ 220 }
            Height={ 180 }>
            <C.TitledPanel Width={ 200 }
                Height={ 160 }
                Title={ <C.Text>Inventory</C.Text> }>
                <C.Tabs><C.TabButton Selected
                    appearance="recipe"><C.Text>Tools</C.Text></C.TabButton></C.Tabs>
                <C.InputScope RequiredItem="minecraft:stick">
                    <C.Row Gap={ 2 }>
                        <C.Slot><C.ItemStack Item="minecraft:stone"
                            Quantity={ 2 } /></C.Slot>
                        <C.Image Source={ {
                            FrameCount: 1,
                            FrameTicks: 1,
                            Height: 16,
                            Id: "packed",
                            Kind: "image",
                            Particle: "test:packed",
                            Version: 1,
                            Width: 16 } } />
                        <C.Mob Type="minecraft:pig" />
                    </C.Row>
                    <C.ScrollView Height={ 70 }><C.Column>
                        <C.Panel><C.Button>
                            <C.Text>Action <C.Text Color="#FF0000">now</C.Text></C.Text>
                        </C.Button></C.Panel>
                        <C.Toggle Checked><C.Text>Enabled</C.Text></C.Toggle>
                        <C.Slider Value={ 0.5 }><C.Text>Volume</C.Text></C.Slider>
                        <C.Callout Kind="Note"
                            Heading={ <C.Text>Heading</C.Text> }><C.Text>Body</C.Text></C.Callout>
                        <C.Divider /><C.Bar Value={ 3 }
                            Maximum={ 10 }><C.Text>Health</C.Text></C.Bar>
                    </C.Column></C.ScrollView>
                </C.InputScope>
            </C.TitledPanel>
        </C.View>
        <C.View Dimension={ { id: "test:other" } }>
            <C.FramedPanel><C.Text>Other</C.Text></C.FramedPanel>
        </C.View>
    </C.ThemeProvider>;
}

// @ts-expect-error Bare strings are not container children.
const Bare = <C.Panel>bare</C.Panel>;
// @ts-expect-error Numbers must be Text children.
const NumberChild = <C.View Dimension="test:world">{42}</C.View>;
// @ts-expect-error Conditional arrays cannot admit strings.
const ArrayChild = <C.Row>{[ "bare" ]}</C.Row>;
// @ts-expect-error Slot accepts at most one element.
const Many = <C.Slot><C.ItemStack Item="a" /><C.ItemStack Item="b" /></C.Slot>;
// @ts-expect-error ItemStack is a leaf.
const StackChild = <C.ItemStack Item="a"><C.Text>bad</C.Text></C.ItemStack>;
// @ts-expect-error Mob is a leaf.
const MobChild = <C.Mob Type="a">bad</C.Mob>;
// @ts-expect-error Divider is a leaf.
const DividerChild = <C.Divider><C.Panel /></C.Divider>;
// @ts-expect-error Image is a leaf.
const ImageChild: C.ImageProps["children"] = "bad";
// @ts-expect-error Future glyph props cannot admit strings.
const GlyphChild: C.GlyphProps["children"] = "bad";
// @ts-expect-error A title is an explicit Text element slot.
const Title = <C.TitledPanel Title="bad" />;
const Heading = <C.Callout Kind="Note"
    // @ts-expect-error A heading is an explicit Text element slot.
    Heading="bad" />;
// @ts-expect-error Labels belong in Text children.
const Label = <C.Button label="bad" />;
// @ts-expect-error No premature Terminal export.
const Terminal = C.Terminal;
// @ts-expect-error Glyph is delivered by its own issue.
const Glyph = C.Glyph;
void [ Bare, NumberChild, ArrayChild, Many, StackChild, MobChild, DividerChild,
    ImageChild, GlyphChild, Title, Heading, Label, Terminal, Glyph ];
