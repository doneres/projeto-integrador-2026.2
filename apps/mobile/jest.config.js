module.exports = {
  preset: 'jest-expo',
  // O primeiro render de cada arquivo paga a importação a frio (NativeWind, expo-router, lucide)
  // e, no runner do CI com workers em paralelo, passa dos 5 s padrão sem haver nada quebrado.
  testTimeout: 20000,
  moduleNameMapper: {
    // O CSS do NativeWind só importa para o Metro; no Jest vira um módulo vazio.
    '\\.css$': '<rootDir>/test/empty-module.js',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // O Jest escolheria a build ESM (.mjs) do lucide pela condição "react-native", e o
    // jest-expo não transforma .mjs. A build CommonJS serve igual para os testes.
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
}
