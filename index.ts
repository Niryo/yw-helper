#!/usr/bin/env node
import {createCommand} from 'commander';
import {execSync} from 'child_process';
import Fuse from 'fuse.js';
import inquirer from 'inquirer';
import fs from 'fs';
import inquirerPrompt from 'inquirer-autocomplete-prompt';
import {createRequire} from "module";
import chalk from 'chalk';
const require = createRequire(import.meta.url);
const packageJson = require("./package.json");

inquirer.registerPrompt('autocomplete', inquirerPrompt);

const yarnWorkspaceRun = createCommand();
yarnWorkspaceRun.version(packageJson.version, '-v, --version', 'output the current version');
yarnWorkspaceRun
  .argument('[workspaceName]', 'The name of the workspace')
  .argument('[command]', 'The command to run')
  .action(async (workspaceNameInput?: string, commandInput?: string) => {

    const allWorkspaces: Record<string, string> = execSync('yarn workspaces list --json', {stdio: 'pipe'}).toString()
      .split('\n')
      .filter(line => line !== '')
      .map((line) => JSON.parse(line))
      .reduce((acc, {location, name}) => {
        acc[name] = location;
        return acc;
      }, {});
    const allWorkspacesNames = Object.keys(allWorkspaces);
    const workspaceName = await getWorkspaceName(workspaceNameInput, allWorkspacesNames);
    const script = commandInput ?? await askForScriptToRun(allWorkspaces[workspaceName]);
    const commandToRun = script !== 'run' ? script : await askForCustomCommandToRun();

    const finalCommand = `yarn workspace ${workspaceName} ${commandToRun}`;
    console.log(chalk.green(`Running: ${finalCommand}`));
    execSync(finalCommand, {stdio: 'inherit'});
  });
yarnWorkspaceRun.parse(process.argv);


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
  const workspaceScripts = Object.keys(JSON.parse(fs.readFileSync(`${workspaceLocation}/package.json`, 'utf-8')).scripts);
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