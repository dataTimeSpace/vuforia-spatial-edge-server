const js = require("@eslint/js");
const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const globals = require("globals");

module.exports = defineConfig([{
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: {
        globals: {
            ...globals.commonjs,
            ...globals.node,
            "Atomics": "readonly",
            "SharedArrayBuffer": "readonly",
        },

        "ecmaVersion": 2020,
        parserOptions: {},
    },
    plugins: {
        js,
    },

    extends: ["js/recommended"],

    "rules": {
        "indent": ["warn", 4],
        "linebreak-style": ["error", "unix"],
        "quotes": "off",
        "semi": ["warn", "always"],

        "comma-spacing": ["warn", {
            before: false,
            after: true,
        }],

        "key-spacing": "warn",
        "keyword-spacing": "warn",
        "no-trailing-spaces": "warn",

        "brace-style": ["warn", "1tbs", {
            allowSingleLine: true,
        }],

        "space-before-blocks": "warn",
        "space-infix-ops": "warn",
        "no-prototype-builtins": "off",

        "no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
        }],

        "no-redeclare": "warn",
        "no-inner-declarations": "off",
        "no-extra-semi": "warn",
        "require-atomic-updates": "off",
        "no-shadow": "warn",
    },
}, globalIgnores([
    "**/pushMe.hyperesources",
    "**/dropzone.js",
    "libraries/webInterface/js",
    "hardwareInterfaces/MIR100/index_old.js",
    "hardwareInterfaces/robot",
    "**/*.min.js",
    "libraries/logicInterfaces.js",
    "libraries/objectDefaultFiles/three",
    "libraries/objectDefaultFiles/toolsocket.js",
    "addons",
    "vuforia-spatial-toolbox-userinterface",
    "spatialToolbox",
]), {
    files: ["libraries/webInterface/**/*.js", "libraries/objectDefaultFiles/**/*.js"],
    languageOptions: {
        globals: {
            ...globals.browser,
            'Atomics': 'readonly',
            'SharedArrayBuffer': 'readonly',

            'realityServer': 'writable',
            'Block': 'writable',
            'BlockLink': 'writable',
            'CRAFTING_GRID_HEIGHT': 'writable',
            'CRAFTING_GRID_WIDTH': 'writable',
            'DEBUG_DATACRAFTING': 'writable',
            'Dropzone': 'writable',
            'Frame': 'writable',
            'Logic': 'writable',
            'LogicGUIState': 'writable',
            'Objects': 'writable',
            'SEA3D': 'writable',
            'TEMP_DISABLE_MEMORIES': 'writable',
            'THREE': 'writable',
            'TWEEN': 'writable',
            'WebKitPoint': 'writable',
            'boundListeners': 'writable',
            'cc': 'writable',
            'cout': 'writable',
            'createNameSpace': 'writable',
            'd3': 'writable',
            'editingAnimationsMatrix': 'writable',
            'editingState': 'writable',
            'frameToObj': 'writable',
            'getAllDivsUnderCoordinate': 'writable',
            'globalCanvas': 'writable',
            'globalDOMCache': 'writable',
            'globalProgram': 'writable',
            'globalScaleAdjustment': 'writable',
            'globalStates': 'writable',
            'groupStruct': 'writable',
            'httpPort': 'writable',
            'hull': 'writable',
            'io': 'writable',
            'objects': 'writable',
            'overlayDiv': 'writable',
            'pocketBegin': 'writable',
            'pocketDropAnimation': 'writable',
            'pocketFrame': 'writable',
            'pocketItem': 'writable',
            'pocketItemId': 'writable',
            'pocketNode': 'writable',
            'publicDataCache': 'writable',
            'realityEditor': 'writable',
            'realityElements': 'writable',
            'rotateX': 'writable',
            'rotationXMatrix': 'writable',
            'rr': 'writable',
            'secondMouseDown': 'writable',
            'showErrorNotification': 'writable',
            'showMessageNotification': 'writable',
            'showSuccessNotification': 'writable',
            'targetDownloadStates': 'writable',
            'timeCorrection': 'writable',
            'timeForContentLoaded': 'writable',
            'trashButton': 'writable',
            'visibleObjectTapDelay': 'writable',
            'visibleObjectTapInterval': 'writable',
            'webkitConvertPointFromPageToNode': 'writable',
        },
    },
}]);
