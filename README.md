# yw-helper
## A tiny lib to make it easier to run commands on yarn workspaces

## install
`npm install -g yw-helper`

## usage
Let's say you want to run the `test`` command inside a workspace named `my-cool-workspace`:
run `yw cool test` or `yw mcw test` or `mycool test` or any search term for your name of your project. `yw` will find the closest match and will run the `test` script.
You can also run `yw` and press enter to get a list of all of your workspaces and choose the correct one using autocomplete. After choosing a workspace, you will get a list of all the scripts inside the workspace,or you can choose `run` to run custom script (something that is not in your list).
