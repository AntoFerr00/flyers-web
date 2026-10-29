// Builds the Android app: exports the UI as static files, copies them into the
// Capacitor project in android/, and compiles a debug APK to dist/FlyerFinder.apk.
//
// Needs the Android SDK (installed by Android Studio's setup wizard) and a
// JDK 21. Both are found in their default Windows locations, or through the
// ANDROID_HOME and JAVA_HOME environment variables.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const isWindows = process.platform === 'win32';

function findJavaHome() {
    if (process.env.JAVA_HOME) return process.env.JAVA_HOME;
    // The JDK bundled with Android Studio is newer than the Gradle version
    // Capacitor uses supports, so look for a separately installed JDK 21.
    const vendors = ['C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Microsoft', 'C:\\Program Files\\Java'];
    for (const dir of vendors.filter(existsSync)) {
        const jdk = readdirSync(dir).find(name => /^jdk-?21/.test(name));
        if (jdk) return join(dir, jdk);
    }
    return null;
}

function findAndroidHome() {
    if (process.env.ANDROID_HOME) return process.env.ANDROID_HOME;
    const sdk = join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
    return existsSync(sdk) ? sdk : null;
}

function run(command, args, options = {}) {
    console.log(`\n> ${command} ${args.join(' ')}`);
    execFileSync(command, args, { stdio: 'inherit', cwd: root, shell: isWindows && command.endsWith('.bat'), ...options });
}

const javaHome = findJavaHome();
const androidHome = findAndroidHome();
if (!javaHome) throw new Error('JDK 21 not found: install it or set JAVA_HOME.');
if (!androidHome) throw new Error('Android SDK not found: run the Android Studio setup wizard or set ANDROID_HOME.');

const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: androidHome };

run(process.execPath, [join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], {
    env: { ...env, BUILD_TARGET: 'android' }
});
run(process.execPath, [join(root, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor'), 'sync', 'android'], { env });
run(join(root, 'android', isWindows ? 'gradlew.bat' : 'gradlew'), ['assembleDebug'], { cwd: join(root, 'android'), env });

const apk = join(root, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
mkdirSync(join(root, 'dist'), { recursive: true });
copyFileSync(apk, join(root, 'dist', 'FlyerFinder.apk'));
console.log(`\nAPK ready: ${join(root, 'dist', 'FlyerFinder.apk')}`);
