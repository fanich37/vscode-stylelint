'use strict';

const { LanguageClient, SettingMonitor, ExecuteCommandRequest } = require('vscode-languageclient');
const { workspace, commands: Commands, window: Window, languages, CodeAction, CodeActionKind, WorkspaceEdit, Range } = require('vscode');

const { activationEvents } = require('./package.json');

const documentSelector = [];

const COMMAND = 'code-actions-sample.command';

class Fixer {
	static getProvidedCodeActionKinds() {
		return [ CodeActionKind.QuickFix ];
	}

	provideCodeActions(document, range) {
		if (!this.isActionsAvailable(document, range)) {
			return;
		}

		const replaceWithSmileyCatFix = this.createFix(document, range, '😺');

		const replaceWithSmileyFix = this.createFix(document, range, '😀');

		// Marking a single fix as `preferred` means that users can apply it with a
		// single keyboard shortcut using the `Auto Fix` command.
		replaceWithSmileyFix.isPreferred = true;

		const replaceWithSmileyHankyFix = this.createFix(document, range, '💩');

		const commandAction = this.createCommand();

		return [
			replaceWithSmileyCatFix,
			replaceWithSmileyFix,
			replaceWithSmileyHankyFix,
			commandAction
		];
	}

	isActionsAvailable(document, range) {
		const start = range.start;
		const line = document.lineAt(start.line);

		return true;
	}

	createFix(document, range, emoji) {
		const fix = new CodeAction(`Convert to ${emoji}`, CodeActionKind.QuickFix);

		fix.edit = new WorkspaceEdit();

		fix.edit.replace(document.uri, new Range(range.start, range.start.translate(0, 2)), emoji);

		return fix;
	}

	createCommand() {
		const action = new CodeAction('Learn more...', CodeActionKind.Empty);

		action.command = { command: COMMAND, title: 'Learn more about emojis', tooltip: 'This will open the unicode emoji page.' };

		return action;
	}
}

for (const activationEvent of activationEvents) {
	if (activationEvent.startsWith('onLanguage:')) {
		const language = activationEvent.replace('onLanguage:', '');

		documentSelector.push({ language, scheme: 'file' }, { language, scheme: 'untitled' });
	}
}

exports.activate = ({ subscriptions }) => {
	const serverPath = require.resolve('./server.js');

	const client = new LanguageClient(
		'stylelint',
		{
			run: {
				module: serverPath,
			},
			debug: {
				module: serverPath,
				options: {
					execArgv: ['--nolazy', '--inspect=6004'],
				},
			},
		},
		{
			documentSelector,
			diagnosticCollectionName: 'stylelint',
			synchronize: {
				configurationSection: 'stylelint',
				fileEvents: workspace.createFileSystemWatcher(
					'**/{.stylelintrc{,.js,.json,.yaml,.yml},stylelint.config.js,.stylelintignore}',
				),
			},
		},
	);

	subscriptions.push(
		languages.registerCodeActionsProvider('css', new Fixer(), {
			providedCodeActionKinds: Fixer.getProvidedCodeActionKinds()
		})
	);

	subscriptions.push(
		Commands.registerCommand('stylelint.executeAutofix', async () => {
			const textEditor = Window.activeTextEditor;

			if (!textEditor) {
				return;
			}

			const textDocument = {
				uri: textEditor.document.uri.toString(),
				version: textEditor.document.version,
			};
			const params = {
				command: 'stylelint.applyAutoFix',
				arguments: [textDocument],
			};

			await client.sendRequest(ExecuteCommandRequest.type, params).then(undefined, () => {
				Window.showErrorMessage(
					'Failed to apply styleint fixes to the document. Please consider opening an issue with steps to reproduce.',
				);
			});
		}),
	);
	subscriptions.push(new SettingMonitor(client, 'stylelint.enable').start());
};
