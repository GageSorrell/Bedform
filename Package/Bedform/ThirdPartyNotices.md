# Third-party notices

Bedform vendors the following MIT-licensed releases into
`Source/Spatial/Internal/React/Vendor`. `Tool/ReactVendor.mts` regenerates this file and every vendored
module from the pinned tarballs; `npm run react-vendor:check --workspace bedform` verifies them.
Each vendored module keeps its upstream `@license React` banner. See
[the React port documentation](Documentation/react-port.md) for the adaptation.

## react@19.3.1

- Tarball: https://registry.npmjs.org/react/-/react-19.3.1.tgz
- Integrity: `sha512-QNhWdt7nrgVWWQG58QuGsAR3jv3Hbe4mb4vz7w2csnHavciZJgda1CPNaldF6eVxv90ud3jUXpKlHL69gO38yw==`
- Vendored files:

| Upstream file | Upstream SHA-256 | Generated module | Patches |
| --- | --- | --- | --- |
| `cjs/react.production.js` | `0b5529981841afa1b58c76ba85c29bb681ff5f07cd8cde6a10b967d3915b8e1c` | `React.production.generated.ts` | None |
| `cjs/react.development.js` | `2d9afa5ada426157ecb2c89984f89d7a3981095615af0a71dfe4ba809998f826` | `React.development.generated.ts` | None |
| `cjs/react-jsx-runtime.production.js` | `1e46f15002696985e80c61d47aaa30dabb03c954270a690f5f7dfbbacfa9002b` | `JsxRuntime.production.generated.ts` | None |
| `cjs/react-jsx-runtime.development.js` | `706e324b21fcd94fb728da71b374694d0727d0baee4126011cea583f54e09106` | `JsxRuntime.development.generated.ts` | None |
| `cjs/react-jsx-dev-runtime.production.js` | `ba9b367119971ed746925a600256d342eb4cc3f2389de013f61e36ff1f3594a5` | `JsxDevRuntime.production.generated.ts` | None |
| `cjs/react-jsx-dev-runtime.development.js` | `e2a2cafea5a317645d75aaad7ca10ac2ed07c178a162a7a675f17b38c6915dd8` | `JsxDevRuntime.development.generated.ts` | None |

### Licence

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## react-reconciler@0.34.0

- Tarball: https://registry.npmjs.org/react-reconciler/-/react-reconciler-0.34.0.tgz
- Integrity: `sha512-eVibvB1fc9j5Qf1KRkiM3GzRPBdjg2P6G6QV2f3P6Eb3OGMxRBhdg2rrUwjbV5JrQaJj8nOa8uajmmJA5tJWjQ==`
- Vendored files:

| Upstream file | Upstream SHA-256 | Generated module | Patches |
| --- | --- | --- | --- |
| `cjs/react-reconciler.production.js` | `41abaf7360ca299162ee0366112e431d365e35a1cee2b2488b9dc382593d1faa` | `Reconciler.production.generated.ts` | None |
| `cjs/react-reconciler.development.js` | `73cba728b9778557367c8688ea28b090946e94a0802a18e17e4e8fdab8376917` | `Reconciler.development.generated.ts` | None |
| `cjs/react-reconciler-constants.production.js` | `413c03d7cb39e4a1474d1dad2faa605bc0e861311bff9fc87a4e43d7dda3e09e` | `ReconcilerConstants.production.generated.ts` | None |
| `cjs/react-reconciler-constants.development.js` | `23d6b2c440bc59ae289532b2585da390f3ac49c3a12c787b7a27c8d7dcbf6bbf` | `ReconcilerConstants.development.generated.ts` | None |

### Licence

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## scheduler@0.28.0

- Tarball: https://registry.npmjs.org/scheduler/-/scheduler-0.28.0.tgz
- Integrity: `sha512-juorfCmIkIw8tT+p5BXSm6PJjQF/ycEYmKyzURCIt/RaZIhL+PulbQ9Yu2z1HdOJDdqDTlxA1+xKBmHXJsczAw==`
- Vendored files:

| Upstream file | Upstream SHA-256 | Generated module | Patches |
| --- | --- | --- | --- |
| `cjs/scheduler.production.js` | `679adff761d31e9426604f80c0e99be44a3e6f4c6834b0218ecf0312a67c171f` | `Scheduler.production.generated.ts` | Yield after the host tick budget instead of a fixed frame interval. |
| `cjs/scheduler.development.js` | `646eb671c8585382baff16daf92fe16a4cdd10dcf1a363c58b2ae1f6bf3a2b8d` | `Scheduler.development.generated.ts` | Yield after the host tick budget instead of a fixed frame interval. |

### Licence

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
