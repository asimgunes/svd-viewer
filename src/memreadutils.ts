/*
 * Copyright 2017-2019 Marcel Ball
 * https://github.com/Marus/cortex-debug
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without
 * limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
 * Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
 * TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

import * as vscode from 'vscode';
import { AddrRange, AddressRangesUtils } from './addrranges';

/** Has utility functions to read memory in chunks into a storage space */
export class MemReadUtils {
    /**
     * Make one or more memory reads and update values. For the caller, it should look like a single
     * memory read but, if one read fails, all reads are considered as failed.
     *
     * @param startAddr The start address of the memory region. Everything else is relative to `startAddr`
     * @param specs The chunks of memory to read and and update. Addresses should be >= `startAddr`, Can have gaps, overlaps, etc.
     * @param storeTo This is where read-results go. The first element represents item at `startAddr`
     */
    public static async readMemoryChunks(
        session: vscode.DebugSession, startAddr: number, specs: AddrRange[], storeTo: number[]): Promise<boolean> {
        const promises = specs.map((r) => {
            return new Promise((resolve, reject) => {
                const addr = '0x' + r.base.toString(16);
                session.customRequest('read-memory', { address: addr, length: r.length }).then((data) => {
                    let dst = r.base - startAddr;
                    const bytes: number[] = data.bytes;
                    for (const byte of bytes) {
                        storeTo[dst++] = byte;
                    }
                    resolve(true);
                }, (e) => {
                    let dst = r.base - startAddr;
                    // tslint:disable-next-line: prefer-for-of
                    for (let ix = 0; ix < r.length; ix++) {
                        storeTo[dst++] = 0xff;
                    }
                    reject(e);
                });
            });
        });

        const results = await Promise.all(promises.map((p) => p.catch((e) => e)));
        const errs: string[] = [];
        results.map((e) => {
            if (e instanceof Error) {
                errs.push(e.message);
            }
        });

        if (errs.length !== 0) {
            throw new Error(errs.join('\n'));
        }

        return true;
    }

    public static readMemory(
        session: vscode.DebugSession, startAddr: number, length: number, storeTo: number[]): Promise<boolean> {
        const maxChunk = (4 * 1024);
        const ranges = AddressRangesUtils.splitIntoChunks([new AddrRange(startAddr, length)], maxChunk);
        return MemReadUtils.readMemoryChunks(session, startAddr, ranges, storeTo);
    }
}
