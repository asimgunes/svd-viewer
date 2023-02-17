/**
 * Copyright (C) 2023 Arm Limited
 */

import * as vscode from 'vscode';
import { PeripheralTreeProvider } from '../views/peripheral';
import { Commands } from '../commands';
import { DebugTracker } from '../debug-tracker';
import { SvdRegistry } from '../svd-registry';
import { SvdResolver } from '../svd-resolver';
import { PeripheralsProvider } from '../peripherals-provider';
export * from '../export';

export const activate = async (context: vscode.ExtensionContext): Promise<SvdRegistry> => {
    const tracker = new DebugTracker();
    const registry = new SvdRegistry();
    const svdResolver = new SvdResolver(registry);
    const provider = new PeripheralsProvider(svdResolver);
    const peripheralTree = new PeripheralTreeProvider(tracker, provider);
    const commands = new Commands(peripheralTree);

    await tracker.activate(context);
    await peripheralTree.activate(context);
    await commands.activate(context);

    return registry;
};

export const deactivate = async (): Promise<void> => {
    // Do nothing for now
};
