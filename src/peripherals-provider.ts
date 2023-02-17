import * as vscode from 'vscode';
import * as manifest from './manifest';
import { SvdResolver } from './svd-resolver';
import { PeripheralNode, PeripheralOptions } from './views/nodes/peripheralnode';
import { SvdData, SVDParser } from './svd-parser';
import { parseStringPromise } from 'xml2js';
import { readFromUrl } from './utils';

const pathToUri = (path: string): vscode.Uri => {
    try {
        return vscode.Uri.file(path);
    } catch (e) {
        return vscode.Uri.parse(path);
    }
};

export class PeripheralsProvider {
    constructor(protected svdResolver: SvdResolver) {
    }

    public async getPeripherals(session: vscode.DebugSession, wsFolderPath?: vscode.Uri): Promise<PeripheralNode[] | undefined> {
        const getPeripheralsConfig = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<string>(manifest.CONFIG_GET_PERIPHERALS) || manifest.DEFAULT_GET_PERIPHERALS;
        const getPeripheralsCommand = session.configuration[getPeripheralsConfig];

        let thresh = session.configuration[manifest.CONFIG_ADDRGAP];
        if (!thresh) {
            thresh = vscode.workspace.getConfiguration(manifest.PACKAGE_NAME).get<number>(manifest.CONFIG_ADDRGAP) || manifest.DEFAULT_ADDRGAP;
        }

        if (((typeof thresh) === 'number') && (thresh < 0)) {
            thresh = -1;     // Never merge register reads even if adjacent
        } else {
            // Set the threshold between 0 and 32, with a default of 16 and a mukltiple of 8
            thresh = ((((typeof thresh) === 'number') ? Math.max(0, Math.min(thresh, 32)) : 16) + 7) & ~0x7;
        }

        if(getPeripheralsCommand) {
            return this.getPeripheralsFromCommand(session, thresh, getPeripheralsCommand);
        } else {
            return this.getPeripheralsFromSVD(session, thresh, wsFolderPath);
        }
    }

    private async getPeripheralsFromCommand(session: vscode.DebugSession, thresh: number, command: string): Promise<PeripheralNode[] | undefined> {
        const response = await vscode.commands.executeCommand(command, session);
        if(!response) {
            return undefined;
        }

        const poptions = response as PeripheralOptions[];
        return poptions.map((options) => new PeripheralNode(session, thresh, options));
    }

    private async getPeripheralsFromSVD(session: vscode.DebugSession, thresh: number, wsFolderPath?: vscode.Uri): Promise<PeripheralNode[] | undefined> {
        const svdPath = await this.svdResolver.resolve(session, wsFolderPath);

        if (!svdPath) {
            return undefined;
        }

        let svdData: SvdData | undefined;

        try {
            let contents: ArrayBuffer | undefined;

            if (svdPath.startsWith('http')) {
                contents = await readFromUrl(svdPath);
            } else {
                const uri = pathToUri(svdPath);
                contents = await vscode.workspace.fs.readFile(uri);
            }

            if (contents) {
                const decoder = new TextDecoder();
                const xml = decoder.decode(contents);
                svdData = await parseStringPromise(xml);
            }
        } catch(e) {
            // eslint-disable-next-line no-console
            console.warn(e);
        }

        if (!svdData) {
            return;
        }

        try {
            return SVDParser.parseSVD(session, svdData, thresh);
        } catch(e) {
            return undefined;
        }
    }
}
