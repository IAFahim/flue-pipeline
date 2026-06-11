import type { FlueContext } from '@flue/runtime';
import * as v from 'valibot';
import { execFileSync } from 'node:child_process';
import spawnExpert from '../agents/spawn-expert';
import spawn from '../skills/spawn/SKILL.md' with { type: 'skill' };

// Smart agent: turn a natural-language request (+ optional scene context) into
// C#, then actually run it in the live Editor via unity-cli and report back.
export async function run({ init, payload }: FlueContext) {
	const request = String((payload as any).request ?? '');
	const context = String((payload as any).context ?? '');

	const harness = await init(spawnExpert);
	const session = await harness.session();

	const { data } = await session.skill(spawn, {
		args: { request, context },
		result: v.object({ code: v.string(), explanation: v.string() }),
	});

	// Full-ECS project: authoring objects must land in the SubScene so they bake
	// into entities. We don't trust the model to bracket scenes correctly — we
	// wrap its creation code: find the SubScene, open it additively, make it
	// active, run the code there, save it, and restore the parent scene. Falls
	// back to the parent scene if there is no SubScene.
	const wrapped = subSceneBracket(data.code);

	let result: string;
	let ok = true;
	try {
		result = execFileSync('unity-cli', ['exec', wrapped], {
			encoding: 'utf8',
			timeout: 60000,
		}).trim();
	} catch (e: any) {
		ok = false;
		result = 'EXEC FAILED: ' + (e?.stderr?.toString?.() || e?.message || String(e));
	}

	return { request, explanation: data.explanation, code: data.code, ok, result };
}

// Wrap object-creation C# so it runs inside the active scene's SubScene.
function subSceneBracket(body: string): string {
	return `
var __parent = UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene();
System.Func<UnityEngine.GameObject,string> __subOf = (go) => {
    var comps = go.GetComponents<UnityEngine.Component>();
    for (int k=0;k<comps.Length;k++){ var c=comps[k]; if(c==null) continue;
        if(c.GetType().Name=="SubScene"){ var so=new UnityEditor.SerializedObject(c); var it=so.GetIterator();
            while(it.NextVisible(true)){ if(it.propertyType==UnityEditor.SerializedPropertyType.ObjectReference && it.objectReferenceValue!=null && it.objectReferenceValue.GetType().Name=="SceneAsset") return UnityEditor.AssetDatabase.GetAssetPath(it.objectReferenceValue); } } }
    return null; };
string __subPath = null;
var __roots = __parent.GetRootGameObjects();
for (int __i=0; __i<__roots.Length; __i++){ var __p = __subOf(__roots[__i]); if(__p!=null){ __subPath=__p; break; } }
System.Func<string> __body = () => {
${body}
};
if (__subPath == null) return "PARENT|" + __body();
var __existing = UnityEditor.SceneManagement.EditorSceneManager.GetSceneByPath(__subPath);
bool __weOpened = false;
UnityEngine.SceneManagement.Scene __sub;
if (__existing.IsValid() && __existing.isLoaded) { __sub = __existing; }
else { __sub = UnityEditor.SceneManagement.EditorSceneManager.OpenScene(__subPath, UnityEditor.SceneManagement.OpenSceneMode.Additive); __weOpened = true; }
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(__sub);
var __msg = __body();
UnityEditor.SceneManagement.EditorSceneManager.SetActiveScene(__parent);
UnityEditor.SceneManagement.EditorSceneManager.SaveScene(__sub);
if (__weOpened) UnityEditor.SceneManagement.EditorSceneManager.CloseScene(__sub, false);
return "SUBSCENE|" + __subPath + "|" + __msg;
`.trim();
}
