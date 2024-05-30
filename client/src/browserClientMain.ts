/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

import * as vscode from 'vscode';
import { LanguageClientOptions } from 'vscode-languageclient';

import { LanguageClient } from 'vscode-languageclient/browser';
import { initVFS } from './virtualFileSystem';

import { log } from './log';

import {
	compileToTarget,
} from './commands/compileToTarget';

import {
	loadModels,
} from './commands/loadModels';

import { inlineSuggestionProvider } from './copilot/inlineSuggestionProvider';
import { promptProvider } from './copilot/promptProvider';
import { createSettingsWebview } from './copilot/configSetting';
import { createStatusBarItem } from './copilot/statusBarItemProvider';
import { codeActionProvider } from './copilot/codeActionProvider';
import { registerToggleSettingsCommands } from './copilot/toggleSettings';
import { registerQuickPickCommand } from './copilot/quickPick';


/**
 * Called when VS Code extension is activated. The conditions for
 * activation are specified in package.json (e.g. opening a .cto file)
 * @param context the extension context
 */
export async function activate(context: vscode.ExtensionContext) {

	log('Accord Project Extension activated');

	const documentSelector = [
		{ language: 'concerto' }, 
		{ language: 'templatemark' }
	];

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		documentSelector,
		// synchronize: {
		// 	fileEvents: vscode.workspace.createFileSystemWatcher('**/logic/*.ts')
		// },
		initializationOptions: {}
	};

	const client = createWorkerLanguageClient(context, clientOptions);

	const disposable = client.start();
	context.subscriptions.push(disposable);

	await client.onReady();
	log('Accord Project client is ready');

	// initialize client-side handlers that
	// expose the workspace.fs filesystem to the language
	// server over RPC - allowing the language server process
	// to query the workspace from its process
	initVFS(client);

	const config = vscode.workspace.getConfiguration('cicero-vscode-extension');
	const enableInlineSuggestions = config.get('enableInlineSuggestions', true);
  	const enableCodeActions = config.get('enableCodeActions', true);

	// register commands
	// menus etc for commands are defined in package.json
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.compileToTarget', (file) => compileToTarget(client,file)));
	
	context.subscriptions.push(vscode.commands
			.registerCommand('cicero-vscode-extension.loadModels', (file) => loadModels(client,file)));	
	
	// Register the inline suggestion provider
	if (enableInlineSuggestions) 
		context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider(
			{ pattern: '**/*' }, // Apply to all file types
			inlineSuggestionProvider(client)
		));
	
	// Register the prompt provider command, startPromptProviderUI
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.startPromptProviderUI', () => promptProvider.showPromptInputBox(client)));

	// Register the settings webview command, configureSettings	
	context.subscriptions.push(vscode.commands
		.registerCommand('cicero-vscode-extension.configureSettings', () => createSettingsWebview(context, client)));

    // Register the quick pick command
    registerQuickPickCommand(context, client);

    // Create and show the status bar item, statusBarItem
    createStatusBarItem(context);
	
	// Register quick fix suggestions
	if (enableCodeActions)
		context.subscriptions.push(vscode.languages.registerCodeActionsProvider(
			{ scheme: 'file'}, { provideCodeActions: codeActionProvider.provideCodeActions }
		)
	)

	// Register the toggle settings commands	
	registerToggleSettingsCommands(context, client);
}

function createWorkerLanguageClient(context: vscode.ExtensionContext, clientOptions: LanguageClientOptions) {
	// Create a web worker. The worker main file implements the language server.
	const serverMain = vscode.Uri.joinPath(context.extensionUri, 'server/dist/browserServerMain.js');
	const worker = new Worker(serverMain.toString(true));

	// create the language server client to communicate with the server running in the worker
	return new LanguageClient('cicero-vscode-extension', 'Accord Project - Server', clientOptions, worker);
}
