/**
 * Copyright (C) 2023 Arm Limited
 */

import * as vscode from 'vscode';

const DEBUG_TRACKER_EXTENSION = 'mcu-debug.debug-tracker-vscode';

interface IDebuggerTrackerEvent {
    event: DebugSessionStatus;
    session?: vscode.DebugSession;
}

interface IDebuggerTrackerSubscribeArgBodyV1 {
    debuggers: string[] | '*';
    handler: (arg: IDebuggerTrackerEvent) => Promise<void>;
}

interface IDebuggerTrackerSubscribeArg {
    version: number;
    body: IDebuggerTrackerSubscribeArgBodyV1;
}

interface IDebugTracker {
    subscribe(arg: IDebuggerTrackerSubscribeArg): void;
}

enum DebugSessionStatus {
    Unknown = 'unknown',
    Initializing = 'initializing',
    Started = 'started',
    Stopped = 'stopped',
    Running = 'running',
    Terminated = 'terminated'
}

export class DebugTracker {
    public constructor(private debugType = '*') {
    }

    private _onWillStartSession: vscode.EventEmitter<vscode.DebugSession> = new vscode.EventEmitter<vscode.DebugSession>();
    public readonly onWillStartSession: vscode.Event<vscode.DebugSession> = this._onWillStartSession.event;

    private _onWillStopSession: vscode.EventEmitter<vscode.DebugSession> = new vscode.EventEmitter<vscode.DebugSession>();
    public readonly onWillStopSession: vscode.Event<vscode.DebugSession> = this._onWillStopSession.event;

    private _onDidStopDebug: vscode.EventEmitter<vscode.DebugSession> = new vscode.EventEmitter<vscode.DebugSession>();
    public readonly onDidStopDebug: vscode.Event<vscode.DebugSession> = this._onDidStopDebug.event;

    public async activate(context: vscode.ExtensionContext): Promise<void> {
        const debugtracker = await this.getTracker();
        if (debugtracker) {
            // Use shared debug tracker extension
            debugtracker.subscribe({
                version: 1,
                body: {
                    debuggers: '*',
                    handler: async event => {
                        if (event.event === DebugSessionStatus.Initializing && event.session) {
                            this._onWillStartSession.fire(event.session);
                        }
                        if (event.event === DebugSessionStatus.Terminated && event.session) {
                            this._onWillStopSession.fire(event.session);
                        }
                        if (event.event === DebugSessionStatus.Stopped && event.session) {
                            this._onDidStopDebug.fire(event.session);
                        }
                    }
                }
            });
        } else {
            // Use vscode debug tracker
            const createDebugAdapterTracker = (session: vscode.DebugSession): vscode.DebugAdapterTracker => {
                return {
                    onWillStartSession: () => this._onWillStartSession.fire(session),
                    onWillStopSession: () => this._onWillStopSession.fire(session),
                    onDidSendMessage: message => {
                        if (message.type === 'event' && message.event === 'stopped') {
                            this._onDidStopDebug.fire(session);
                        }
                    }
                };
            };

            context.subscriptions.push(
                vscode.debug.registerDebugAdapterTrackerFactory(this.debugType, { createDebugAdapterTracker })
            );
        }
    }

    private async getTracker(): Promise<IDebugTracker | undefined> {
        try {
            const trackerExtension = vscode.extensions.getExtension<IDebugTracker>(DEBUG_TRACKER_EXTENSION);
            if (trackerExtension) {
                return trackerExtension.activate();
            }
        } catch(_e) {
            // Ignore error
        }

        return undefined;
    }
}
