#!/usr/bin/env node
import {createCommand} from 'commander';
import {execSync} from 'child_process';
import Fuse from 'fuse.js';
import inquirer from 'inquirer';
import fs from 'fs';
import path from 'path';
import inquirerPrompt from 'inquirer-autocomplete-prompt';
import chalk from 'chalk';
import {version} from './version.js';


const COMMAND_HISTORY_FILE = fs.existsSync('.vscode')? `${process.cwd()}/.vscode/yw_helper_history.txt` : `${process.cwd()}/.idea/yw_helper_history.txt`;
inquirer.registerPrompt('autocomplete', inquirerPrompt);

const yarnWorkspaceRun = createCommand();
yarnWorkspaceRun.version(version, '-v, --version', 'output the current version');
yarnWorkspaceRun
  .allowUnknownOption(true)
  .argument('[workspaceName]', 'The name of the workspace')
  .argument('[command...]', 'The command to run')
  .option('-r, --re-run', 'Run again the last command')
  .option('-c, --command-history', 'Show command history')
  .option('-w, --reuse-workspace', 'Use the same workspace as last time')
  .action(async (workspaceNameInputOrCommand: string, commandInput: string[]) => {
    verifyYarn();

    if(yarnWorkspaceRun.opts().commandHistory) {
      const commandHistory = getCommandHistory();
      const setOfLastCommands = Array.from(new Set(commandHistory.reverse()));
      const { selectedCommand } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedCommand',
          message: 'Select a command to run:',
          choices: setOfLastCommands,
        },
      ]);

      console.log(chalk.green(`Running selected command: ${selectedCommand}`));
      appendToCommandHistory(selectedCommand);
      execSync(selectedCommand, { stdio: 'inherit' });
      return;
    }

    if (yarnWorkspaceRun.opts().reRun) {
      const lastCommand = getCommandHistory().pop();
      if (lastCommand) {
        console.log(chalk.green(`Running last command: ${lastCommand}`));
        execSync(lastCommand, {stdio: 'inherit'});
        return;
      } else {
        console.log(chalk.yellow('Could not find last command'));
      }
    }

    const allWorkspaces: Record<string, string> =
      listWorkspaces()
        .split('\n')
        .filter(line => line !== '')
        .map((line) => JSON.parse(line))
        .filter(({location}) => location !== '.')
        .reduce((acc, {location, name}) => {
          acc[name] = location;
          return acc;
        }, {})
    const allWorkspacesNames = Object.keys(allWorkspaces);
    const isSingleWorkspace = allWorkspacesNames.length === 1;

    let workspaceName: string;
    const lastCommand = getCommandHistory().pop();
    if (yarnWorkspaceRun.opts().reuseWorkspace && lastCommand) {
      const lastWorkspace = lastCommand.split(' ')[2];
      if (lastWorkspace === undefined) {
        console.log(chalk.red('Could not find last workspace'));
        process.exit(1);
      }
      workspaceName = lastWorkspace;
      workspaceNameInputOrCommand && commandInput.unshift(workspaceNameInputOrCommand);
      console.log(chalk.green(`Using last workspace: ${workspaceName}`));
    } else if (isSingleWorkspace) {
      workspaceName = allWorkspacesNames[0];
      // if there is only one workspace, we assume workspaceNameInputOrCommand is actually a command so we add it to the commandInput array
      workspaceNameInputOrCommand && commandInput.unshift(workspaceNameInputOrCommand);
      console.log(chalk.green(`Found workspace: ${workspaceName}`));
    } else {
      const workspaceNameInput = workspaceNameInputOrCommand;
      workspaceName = await getWorkspaceName(workspaceNameInput, allWorkspacesNames);
    }
    let script: string;
    if (commandInput.length > 0) {
      script = commandInput.join(' ');
    } else if (allWorkspacesNames.length === 1 && workspaceNameInputOrCommand) {
      script = workspaceNameInputOrCommand.concat(...commandInput); //if there is only one workspace, we assume workspaceNameInputOrCommand is actually a command
    } else {
      script = await askForScriptToRun(allWorkspaces[workspaceName]);
    }
    const commandToRun = script !== 'run' ? script : await askForCustomCommandToRun();

    const finalCommand = `yarn workspace ${workspaceName} ${commandToRun}`;
    console.log(chalk.green(`Running: ${finalCommand}`));
    appendToCommandHistory(finalCommand);
    // execSync(`echo '${finalCommand}' | tee -a ~/.bash_history ~/.zsh_history >/dev/null &&  history -r ~/.bash_history 2> /dev/null || fc -R`)
    execSync(finalCommand, {stdio: 'inherit'});
  });
yarnWorkspaceRun.parse(process.argv);

function appendToCommandHistory(command: string){
  execSync(`mkdir -p ${path.dirname(COMMAND_HISTORY_FILE)} && touch ${COMMAND_HISTORY_FILE}`);
  fs.appendFileSync(COMMAND_HISTORY_FILE, command + '\n');
}

async function getWorkspaceName(workspaceNameInput: string | undefined, workspacesNames: string[]) {
  const fuseWorkspaceNames = new Fuse(workspacesNames, {ignoreLocation: true});
  if (workspaceNameInput) {
    const foundName = fuseWorkspaceNames.search(workspaceNameInput)[0]?.item
    if (foundName) {
      console.log(chalk.green(`Found workspace: ${foundName}`));
      return foundName;
    } else {
      console.log(chalk.red(`Could not find workspace with the name of ${workspaceNameInput}, please select workspace from the list below:`));
    }
  }
  return (await inquirer
    .prompt([
      {
        type: 'autocomplete',
        name: 'workspaceName',
        message: 'Workspace',
        source: (_answersSoFar: any, input: string) => {
          if (!input) {
            return workspacesNames;
          }
          return fuseWorkspaceNames.search(input).map(({item}) => item);
        },
      },
    ])).workspaceName;
}

async function askForScriptToRun(workspaceLocation: string) {
  const workspaceScripts = Object.keys(JSON.parse(fs.readFileSync(`${workspaceLocation}/package.json`, 'utf-8')).scripts || {});
  workspaceScripts.unshift('run');
  const fuseWorkspaceScripts = new Fuse(workspaceScripts, {ignoreLocation: true});
  return (await inquirer
    .prompt([
      {
        type: 'autocomplete',
        name: 'script',
        message: 'Script',
        source: (_answersSoFar: any, input: string) => {
          if (!input) {
            return workspaceScripts;
          }
          return fuseWorkspaceScripts.search(input).map(({item}) => item);
        },
      },
    ])).script;
}

async function askForCustomCommandToRun() {
  return (await inquirer.prompt({
    message: 'Run:',
    type: 'input',
    name: 'commandToRun',
  })).commandToRun;
}

function verifyYarn() {
  try {
    execSync('yarn --version', {stdio: 'pipe'});
  } catch (e) {
    console.log(chalk.red('yarn is not installed, please install yarn before using this tool'));
    process.exit(1);
  }
}

function getCommandHistory() {
  if (fs.existsSync(COMMAND_HISTORY_FILE)) {
    return fs.readFileSync(COMMAND_HISTORY_FILE, 'utf-8').trim().split('\n');
  }
  return [];
}

function listWorkspaces() {
  try {
    return execSync('yarn workspaces list --json', {stdio: 'pipe'})
    .toString()
  } catch (e) {
    console.log(chalk.red('yarn workspaces list failed, please make sure you are running this command from the root of the monorepo'));
    process.exit(1);
  }
}