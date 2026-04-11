# CONVENTIONS.md

Regras obrigatórias para o frontend. O Claude deve seguir estas convenções em toda refatoração, sem exceções.

---

## Stack

- **React** com **Vite**
- **JavaScript** (sem TypeScript)
- **Tailwind CSS** para estilização
- Sem CSS externo, sem styled-components, sem inline style (exceto valores dinâmicos impossíveis de fazer com Tailwind)

---

## Princípios gerais

- Seguir **SOLID** adaptado ao React:
  - **S** — cada componente tem uma única responsabilidade
  - **O** — componentes extensíveis via props, sem modificar o componente pai
  - **L** — componentes filhos não quebram o contrato do pai
  - **I** — props específicas por componente, sem passar objetos genéricos desnecessários
  - **D** — lógica de negócio separada da UI; componentes dependem de abstrações (hooks), não de implementações diretas
- **Não mudar comportamento** durante a refatoração — apenas estrutura
- **Sem over-engineering** — se um componente simples resolve, não criar abstração

---

## Estrutura de pastas

```
src/
├── components/        # Componentes reutilizáveis e genéricos
│   └── Button/
│       ├── Button.jsx
│       └── index.js
├── features/          # Módulos de funcionalidade (agrupam componentes, hooks e helpers de um domínio)
│   └── Auth/
│       ├── components/
│       ├── hooks/
│       └── index.js
├── hooks/             # Hooks globais reutilizáveis
├── pages/             # Páginas (uma por rota)
├── services/          # Chamadas de API e integrações externas
├── utils/             # Funções utilitárias puras
└── assets/            # Imagens, fontes, ícones estáticos
```

---

## Componentes

- Um componente por arquivo
- Nome do arquivo igual ao nome do componente (`Button.jsx`, não `button.jsx`)
- Pasta própria para componentes com variantes ou sub-componentes
- `index.js` em cada pasta apenas para re-exportar — nunca colocar lógica no index
- Componentes de UI são **puros**: recebem props, renderizam, sem side effects
- Componentes de página orquestram features, não contêm lógica de negócio diretamente

### Tamanho

- Máximo ~150 linhas por componente
- Se passou disso, extrair sub-componentes ou mover lógica para hook

### Props

- Props com nomes descritivos (`onSubmit`, não `fn`)
- Desestruturar props no parâmetro da função
- Sem prop drilling além de 2 níveis — usar Context ou elevar estado

---

## Hooks

- Toda lógica de estado e side effects fica em hooks customizados
- Nome sempre começa com `use` (`useAuth`, `useFormValidation`)
- Um hook por responsabilidade
- Hooks de domínio ficam em `features/*/hooks/`
- Hooks globais reutilizáveis ficam em `src/hooks/`

---

## Estilização com Tailwind

- Usar apenas classes Tailwind — sem CSS externo
- Para conjuntos de classes repetidos, extrair componente, não criar classe CSS customizada
- Ordem de classes: layout → box model → tipografia → cor → estado (`flex`, `p-4`, `text-sm`, `text-gray-700`, `hover:text-black`)
- Variantes condicionais com template literal ou lib `clsx`/`cx`:
  ```jsx
  className={clsx('base-classes', isActive && 'active-classes')}
  ```

---

## Serviços e API

- Todas as chamadas de API ficam em `src/services/`
- Componentes e hooks nunca chamam `fetch` diretamente — sempre via service
- Funções de service são puras e assíncronas, sem estado interno

---

## Nomenclatura

| Elemento | Convenção | Exemplo |
|---|---|---|
| Componente | PascalCase | `UserCard` |
| Hook | camelCase com `use` | `useUserData` |
| Função utilitária | camelCase | `formatDate` |
| Arquivo de componente | PascalCase | `UserCard.jsx` |
| Arquivo de hook/util | camelCase | `useUserData.js` |
| Constante global | UPPER_SNAKE_CASE | `API_BASE_URL` |

---

## O que não fazer

- Não criar componentes com lógica de negócio misturada com JSX
- Não usar `useEffect` para derivar estado — usar `useMemo` ou calcular direto
- Não exportar componentes anônimos (`export default () => {}`)
- Não importar de caminhos relativos longos (`../../../components`) — configurar path alias no Vite
- Não duplicar lógica — se usou duas vezes, extrair para hook ou util

---

## Path aliases (configurar no Vite)

```js
// vite.config.js
resolve: {
  alias: {
    '@': '/src',
    '@components': '/src/components',
    '@features': '/src/features',
    '@hooks': '/src/hooks',
    '@services': '/src/services',
    '@utils': '/src/utils',
  }
}
```

Importações devem usar aliases:
```js
import Button from '@components/Button'
```