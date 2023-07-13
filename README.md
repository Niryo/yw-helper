# yw-helper
#### A tiny lib to make it easier to run commands on yarn workspaces

#### Install
`npm install -g yw-helper`

#### Example

https://github.com/Niryo/yw-helper/assets/8758348/0b29fae8-e2e1-4f76-b42c-a0a6178737a3



#### usage
Let's say you want to run the `test` command inside a workspace named my-cool-workspace. You can run:

- `yw cool test`
- `yw mcw test`
- `mycool test`
- Any other search term that matches your project name.

yw will find the closest match and will run the test script.

You can also run `yw` and press enter to get a list of all your workspaces. Then, you can choose the correct one using autocomplete. After choosing a workspace, you will get a list of all the scripts inside the workspace. You can also choose run to run a custom script (something that is not in your list).
