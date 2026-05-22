/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment: '순환 의존성 금지',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'info',
      comment: '어디서도 import 되지 않는 모듈 경고',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(vite|eslint)\\.config\\.(js|cjs|mjs|ts)$',
          'src/main\\.tsx$',
          'src/vite-env\\.d\\.ts$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: 'node_modules' },
    includeOnly: '^src',
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      mermaid: {
        // depcruise --output-type mermaid 가 사용
      },
      archi: {
        collapsePattern: '^(src/(api|pages|stores|types|layouts|hooks|components))/[^/]+',
      },
    },
  },
};
