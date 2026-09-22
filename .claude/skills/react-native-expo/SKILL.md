---
name: react-native-expo
description: >
  Use this skill whenever the task involves generating, refactoring, or auditing a
  React Native Expo codebase for production readiness — icon extraction, primitive and
  composite component architecture, theme token enforcement, spec-driven service layer,
  Expo Router navigation patterns, or any performance / correctness sweep of a mobile app.
  Triggers: "react native", "expo", "refactor rn", "mobile screens", "expo router",
  "rn components", "react native production", "make expo app production ready",
  "generate screen", "rn screen generation".
---

# React Native Expo Production Refactor Skill

You are a senior React Native / Expo architect performing a full production-readiness
sweep of a mobile codebase. Your goal: one pass leaves it clean, type-safe, performant,
and ready to serve millions of users across iOS and Android without a single jank frame.

**This is not a web codebase. There is no DOM. Read every section before touching a file.**

---

## 0 · Pre-Flight — Build a Complete Mental Model First

Before any writes, scan the entire codebase and record:

| What to find                                                                                | Why                                  |
| ------------------------------------------------------------------------------------------- | ------------------------------------ |
| `constants/theme.ts` or equivalent colour/spacing token file                                | Needed for §3 token enforcement      |
| Every inline SVG or raw `<Image source={require(…)}>` icon usage                            | Needed for §1 icon extraction        |
| Every raw `<Pressable>` / `<TouchableOpacity>` / `<TextInput>` outside `components/common/` | Needed for §2 common component audit |
| Every screen file containing non-wiring JSX or inline component definitions                 | Needed for §2 component extraction   |
| Every `interface` / `type` describing an API shape outside a service file                   | Needed for §5 service layer          |
| Every mock/stub data array outside `*.mock.ts`                                              | Needed for §5 service layer          |
| Every raw `fetch` / `axios` call outside service files                                      | Needed for §5 service layer          |
| Every `<Image>` not using `expo-image`                                                      | Needed for §4 optimisations          |
| Every long list rendered with `.map()` instead of `FlashList` / `FlatList`                  | Needed for §4                        |
| Every inline style object defined inside a render function                                  | Needed for §4                        |
| Every screen missing `SafeAreaView` or safe area insets handling                            | Needed for §4                        |
| Every heavy component not lazily imported                                                   | Needed for §4                        |
| Every screen missing error boundary or crash reporting                                      | Needed for §4                        |

Do not start Phase 2 until this inventory is complete.

---

## 1 · Icons — `components/icons/`

React Native has no SVG support natively. All icons go through `react-native-svg` and
are wrapped as typed components. Never use raw `<Image>` for icons.

### 1.1 Extraction loop

```
For each icon found anywhere (inline SVG string, raw <Image> of an icon asset,
@expo/vector-icons used inline, or react-native-svg used inline):
  1. Normalise the path data. Check the duplication map.
  2. If this shape already exists as an icon file → replace usage with the import.
  3. Otherwise:
     a. Choose a name (§1.2).
     b. Create components/icons/<Name>Icon.tsx using the template (§1.3).
     c. Update components/icons/index.ts barrel (§1.4).
     d. Replace the original usage with <NameIcon … />.
```

### 1.2 Naming rules

- **PascalCase, always suffixed `Icon`** → `ChevronDownIcon`, `UserCircleIcon`
- **Name the purpose, not the shape** → `SearchIcon` not `MagnifyingGlassIcon`
- **One name per shape** — if two purposes share a shape, use the more generic name
- **No abbreviations** → `NavigationIcon` not `NavIcon`

### 1.3 Icon template

```tsx
// components/icons/ArrowRightIcon.tsx
import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

export interface ArrowRightIconProps extends SvgProps {
  size?: number;
  color?: string;
}

export function ArrowRightIcon({
  size = 24,
  color = 'currentColor',
  ...props
}: ArrowRightIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...props}
    >
      <Path d="…" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default ArrowRightIcon;
```

# React Native Development Guidelines

When generating or modifying code, follow these principles consistently:

1. **Prefer NativeWind (`className`) for styling**
   - Use `className` for all static styling whenever possible.
   - Use the `style` prop only when values are dynamic and depend on hooks such as `useResponsive` (e.g., responsive widths, heights, spacing, or calculations).

2. **Build modular UI**
   - Break the UI into small, reusable, and focused components wherever it improves readability, maintainability, or reusability.
   - Avoid creating unnecessarily large screen components.

3. **Keep business logic out of components**
   - Encapsulate business logic, data transformation, side effects, state management, and API interactions inside custom hooks.
   - UI components should primarily be responsible for rendering and handling user interactions.

4. **Design for seamless API integration**
   - Structure components so they can be easily connected to the Client SDK without significant refactoring.
   - Keep presentation separate from data fetching.
   - Define clear props and data contracts that mirror expected SDK models.
   - Avoid hardcoded or mock-specific logic inside UI components. Mock data should be easy to replace with SDK responses.

5. **Favor maintainability**
   - Write readable, composable, and scalable code.
   - Avoid duplication by extracting common UI patterns, utilities, and hooks.
   - Keep files focused on a single responsibility.

**Hard rules:**

- `size` controls both `width` and `height` — never separate props
- `color` defaults to `"currentColor"` as a convention; callers pass a theme token value
- Icons are always decorative — set `accessibilityElementsHidden` and
  `importantForAccessibility="no-hide-descendants"` so screen readers skip them;
  the surrounding Pressable / Text provides the accessible label
- Export named AND default
- Never hardcode a colour value directly — always receive `color` as a prop from the theme

### 1.4 Barrel

`components/icons/index.ts` — one named export per file, alphabetical:

```ts
export { ArrowRightIcon } from './ArrowRightIcon';
export type { ArrowRightIconProps } from './ArrowRightIcon';
export { ChevronDownIcon } from './ChevronDownIcon';
```

---

## 2 · Component Architecture — Three-Tier Hierarchy

Every piece of UI lives at exactly one tier. Never skip a tier or mix responsibilities.

```
Tier 1 · Primitives    components/common/
          Single-purpose RN atoms. No business logic. No domain types.
          Examples: Button, AppTextInput, Badge, Avatar, Checkbox, RadioButton,
                    Spinner, Skeleton, Divider, Tag, BottomSheet, Toast

Tier 2 · Composites    components/
          Combine 2+ primitives into a meaningful domain UI unit.
          May hold local state. References domain types from the service layer.
          Examples: ProductCard, UserProfileHeader, OrderSummary, SearchBar,
                    NotificationItem, DashboardStatCard, PaymentMethodRow

Tier 3 · Screens       app/**/  (Expo Router file-based screens)
          Orchestrates composites. Fetches data. Owns navigation concerns.
          No UI logic, no inline components, no style decisions.
```

**The dependency rule is one-way and strict:**
`screen` → `components/` → `components/common/` → `components/icons/`
A lower tier never imports from a higher tier.

---

### 2.1 Common Components — `components/common/`

#### What makes something a common component

- Wraps a single RN core element (`View`, `Pressable`, `TextInput`, `Text`) or a very
  tight group of coupled elements
- Zero domain knowledge — no `Product`, `User`, or any service type in props
- Accepts only generic props: `children`, `variant`, `size`, `disabled`, `style`, handlers
- Purely presentational — no fetch, no service calls, no `useRouter`
- The only place in the codebase where that element's base style is defined

If a raw `<Pressable>` with inline styles appears anywhere outside `components/common/`,
that is a bug to fix.

#### Common component audit

Flag every instance of:

- Colours hardcoded directly on a `<Text>` or `<View>` instead of going through theme tokens

#### Primitive template — AppTextInput

```tsx
// components/common/AppTextInput.tsx
import { forwardRef, useRef, useState } from 'react';
import {
  TextInput,
  View,
  Text,
  Pressable,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, radius, typography } from '@/constants/theme';

export interface AppTextInputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(
  (
    { label, hint, error, leadingIcon, trailingIcon, containerStyle, ...props },
    ref,
  ) => {
    const [focused, setFocused] = useState(false);

    return (
      <View style={containerStyle}>
        {label && (
          <Text
            style={{
              ...typography.labelSm,
              color: colors.text.primary,
              marginBottom: spacing[1],
            }}
          >
            {label}
          </Text>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: error
              ? colors.error[500]
              : focused
                ? colors.primary[500]
                : colors.border.subtle,
            borderRadius: radius.lg,
            backgroundColor: colors.surface[50],
            paddingHorizontal: spacing[3],
            height: 44,
          }}
        >
          {leadingIcon && (
            <View style={{ marginRight: spacing[2] }}>{leadingIcon}</View>
          )}
          <TextInput
            ref={ref}
            style={{
              flex: 1,
              ...typography.bodySm,
              color: colors.text.primary,
            }}
            placeholderTextColor={colors.text.disabled}
            accessibilityLabel={label}
            accessibilityHint={hint}
            accessibilityInvalid={!!error}
            onFocus={(e) => {
              setFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          {trailingIcon && (
            <View style={{ marginLeft: spacing[2] }}>{trailingIcon}</View>
          )}
        </View>
        {error && (
          <Text
            style={{
              ...typography.captionSm,
              color: colors.error[600],
              marginTop: spacing[1],
            }}
          >
            {error}
          </Text>
        )}
        {!error && hint && (
          <Text
            style={{
              ...typography.captionSm,
              color: colors.text.secondary,
              marginTop: spacing[1],
            }}
          >
            {hint}
          </Text>
        )}
      </View>
    );
  },
);

AppTextInput.displayName = 'AppTextInput';
export default AppTextInput;
```

#### Common component hard rules

- Always use `forwardRef` — callers need refs for keyboard focus management
- `displayName` must be set explicitly when using `forwardRef`
- Export named AND default
- Props interface always extends the relevant RN element's attribute type
- `variant` and `size` use string literal unions with a lofoodp object — never if/else chains
- **Never use `StyleSheet.create()` inside a component with variant logic** — use plain
  style objects in lofoodp maps so variant styles are just object references
- `StyleSheet.create()` is appropriate for static non-variant styles only
- All accessibility props (`accessibilityRole`, `accessibilityLabel`, `accessibilityState`,
  `accessibilityHint`, `accessibilityInvalid`) are wired inside the common component —
  callers in `components/` and screens should never need to add them manually
- Animated press feedback (`react-native-reanimated`) belongs inside `components/common/`
  interactive components — one consistent feel across the whole app

#### `components/common/` barrel

`components/common/index.ts`:

```ts
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { AppTextInput } from './AppTextInput';
export type { AppTextInputProps } from './AppTextInput';
// … alphabetical, export types alongside components
```

---

### 2.2 What belongs in a screen file (`app/**/`)

```
✅ ALLOWED in a screen
  export default Screen() function
  useLocalSearchParams() for route params
  Top-level data fetching via service functions or hooks
  Promise.all() for parallel independent fetches
  Passing data as props to components
  <ScrollView> / <KeyboardAvoidingView> as the outermost layout wrapper
  <SafeAreaView> or useSafeAreaInsets() at the screen root
  Expo Router <Stack.Screen options={…}> for header config

❌ NOT ALLOWED in a screen
  useState / useReducer for UI state — belongs in a component or custom hook
  Inline component definitions: const Card = () => …
  JSX subtrees longer than ~10 lines that could be named
  StyleSheet entries for component-level elements — extract to components/
  Any import from *.mock.ts (allowed only temporarily with a TODO comment)
  Direct use of components/common/ — screens compose via components/, not raw atoms
  Business logic — belongs in a service or custom hook
```

### 2.3 Component rules (`components/`)

A component belongs in `components/` when it:

- Combines 2+ common components from `components/common/` into a named, meaningful domain UI unit
- Contains its own local state OR could plausibly be reused across 2+ screens
- Has a clear single responsibility that can be expressed in its name
- References domain types from the service layer

**Variant prop over duplication** — if two screens use the same component with minor
visual differences, add a `variant` or `size` prop. Never create a second file.

### 2.4 Component template (`components/`)

```tsx
// components/ProductCard.tsx
import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from '@/components/common';
import { ArrowRightIcon } from '@/components/icons';
import { colors, spacing, radius, typography } from '@/constants/theme';
import type { Product } from '@/services/product/types';

export interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'compact';
  onSelect?: (id: string) => void;
}

export function ProductCard({
  product,
  variant = 'default',
  onSelect,
}: ProductCardProps) {
  const handleSelect = useCallback(
    () => onSelect?.(product.id),
    [onSelect, product.id],
  );

  return (
    <View style={[styles.container, variant === 'compact' && styles.compact]}>
      <Text style={styles.title}>{product.title}</Text>
      <Button
        variant="secondary"
        size="sm"
        label="View details"
        trailingIcon={<ArrowRightIcon size={16} color={colors.text.primary} />}
        onPress={handleSelect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface[100],
    borderRadius: radius.xl,
    padding: spacing[4],
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
  },
  title: {
    ...typography.bodyMd,
    color: colors.text.primary,
  },
});

export default ProductCard;
```

**Hard rules:**

- Props interface named `<ComponentName>Props`, always exported
- Prop types come from the service layer types — never redeclare shapes inline
- `StyleSheet.create()` for all static styles — never inline style objects in JSX
- `useCallback` on every event handler passed as a prop — prevents unnecessary child re-renders
- Never use raw `<Pressable>` or `<TextInput>` — always go through `components/common/`
- Never duplicate a file — add a prop instead

### 2.5 `components/` barrel

`components/index.ts` — same pattern as the `components/common/` barrel.

---

## 3 · Theme Token Enforcement

### 3.1 The theme file — `constants/theme.ts`

All design tokens live here. This is the single source of truth. Nothing outside this
file should have a hardcoded colour, spacing value, or border radius.

```ts
// constants/theme.ts

export const colors = {
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
    950: '#172554',
  },
  surface: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    200: '#E5E5E5',
    900: '#171717',
  },
  text: {
    primary: '#171717',
    secondary: '#737373',
    disabled: '#A3A3A3',
    inverse: '#FFFFFF',
  },
  border: {
    subtle: '#E5E5E5',
    default: '#D4D4D4',
    strong: '#A3A3A3',
  },
  error: { 500: '#EF4444', 600: '#DC2626' },
  success: { 500: '#22C55E', 600: '#16A34A' },
  warning: { 500: '#F59E0B', 600: '#D97706' },
  inverse: '#FFFFFF',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  '2xl': 16,
  full: 9999,
} as const;

export const typography = {
  displayLg: { fontSize: 32, lineHeight: 40, fontWeight: '700' as const },
  displayMd: { fontSize: 28, lineHeight: 36, fontWeight: '700' as const },
  headingLg: { fontSize: 24, lineHeight: 32, fontWeight: '600' as const },
  headingMd: { fontSize: 20, lineHeight: 28, fontWeight: '600' as const },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  bodyMd: { fontSize: 14, lineHeight: 20, fontWeight: '400' as const },
  bodySm: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  labelLg: { fontSize: 16, lineHeight: 24, fontWeight: '500' as const },
  labelMd: { fontSize: 14, lineHeight: 20, fontWeight: '500' as const },
  labelSm: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  captionSm: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;
```

### 3.2 Token audit loop

```
For every StyleSheet.create() block and every inline style:
  1. Find colour values: any hex string, rgb(), or named colour
  2. Check against colors in constants/theme.ts
  3. If a matching token exists → replace with the token reference
  4. If no token exists → leave the value with a // TODO: add to theme comment
  5. Find spacing values: any number used as padding/margin/gap/size
  6. If the value matches a spacing token → replace with spacing[N]
  7. If not → keep the value with a // TODO: add spacing token comment
```

### 3.3 Replacement examples

```
❌ color: "#FFFFFF"          → ✅ color: colors.inverse
❌ color: "#171717"          → ✅ color: colors.text.primary
❌ backgroundColor: "#F5F5F5" → ✅ backgroundColor: colors.surface[100]
❌ borderColor: "#E5E5E5"    → ✅ borderColor: colors.border.subtle
❌ padding: 16               → ✅ padding: spacing[4]
❌ borderRadius: 8           → ✅ borderRadius: radius.lg
❌ fontSize: 14              → ✅ ...typography.bodyMd
```

### 3.4 Dark mode — design for it from day one

Structure the theme to support dark mode immediately even if not yet implemented:

```ts
// constants/theme.ts — dark mode ready
import { Appearance } from 'react-native';

export function getColors(scheme: 'light' | 'dark' = 'light') {
  return scheme === 'dark' ? darkColors : lightColors;
}
```

Pass the resolved colour set through a `ThemeContext` or `useTheme()` hook — never
read `Appearance.getColorScheme()` directly inside a component.

---

## 4 · Expo & React Native Optimisations — Full Production Checklist

Every item below is non-negotiable for a codebase serving millions of mobile users.

### 4.1 Lists — the #1 React Native performance issue

```
Rule: never render a list with .map() if it can grow beyond ~10 items.

Choice hierarchy:
  @shopify/flash-list (FlashList)   → best performance, use for all production lists
  FlatList                          → acceptable for short static lists
  SectionList                       → when you need grouped sections
  ScrollView + .map()               → only for ≤ 5 items that will never grow
```

FlashList template:

```tsx
import { FlashList } from '@shopify/flash-list';
import type { Product } from '@/services/product/types';

<FlashList
  data={products}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <ProductCard product={item} />}
  estimatedItemSize={80} // critical — measure the real rendered height
  showsVerticalScrollIndicator={false}
  contentContainerStyle={{ padding: spacing[4] }}
/>;
```

Rules:

- `estimatedItemSize` must be close to the real size — measure with `onLayout` if unsure
- `keyExtractor` must return a stable, unique string — never array index
- `renderItem` must be a stable reference — define outside JSX or use `useCallback`
- `getItemType` when the list contains multiple item types (e.g. header rows + content rows)

### 4.2 StyleSheet — static over inline

```tsx
// ❌ — new object created every render, breaks shouldComponentUpdate / memo
<View style={{ padding: 16, backgroundColor: "#fff" }}>

// ✅ — reference is stable, StyleSheet optimises for native
const styles = StyleSheet.create({
  container: { padding: spacing[4], backgroundColor: colors.surface[50] },
});
<View style={styles.container}>
```

Rules:

- `StyleSheet.create()` at module level — never inside a component function
- Inline styles are allowed only for dynamic values that genuinely change per render
  (e.g. `{ width: progress * 100 }` for an animated progress bar)
- Merge arrays for conditional styles: `style={[styles.base, variant === "compact" && styles.compact]}`

### 4.3 Images — `expo-image` everywhere

Replace every `<Image>` from `react-native` with `expo-image`:

```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: product.imageUrl }}
  style={{ width: 120, height: 120, borderRadius: radius.lg }}
  placeholder={blurhash} // perceived performance
  contentFit="cover"
  transition={200} // smooth fade-in
  cachePolicy="memory-disk" // aggressive caching
  recyclingKey={product.id} // FlatList/FlashList memory recycling
/>;
```

Rules:

- Always provide explicit `width` and `height` — flexible dimensions cause layout thrash
- Use `placeholder` with a `blurhash` for all remote images
- Set `cachePolicy="memory-disk"` for product/profile images that repeat across screens
- Set `recyclingKey` when inside a FlashList/FlatList — prevents ghost images

### 4.4 Fonts — `expo-font` and no layout shift

```tsx
// app/_layout.tsx
import { useFonts } from 'expo-font';
import { SplashScreen } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    'Inter-Regular': require('@/assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('@/assets/fonts/Inter-SemiBold.ttf'),
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null; // splash screen stays visible until fonts are ready
  return <Slot />;
}
```

Rules:

- Load fonts in the root `_layout.tsx` only — never in a screen or component
- Keep the splash screen up until fonts are loaded — prevents FOUT (flash of unstyled text)
- Reference fonts in the theme's `typography` object — never hardcode font family strings

### 4.5 Keyboard handling

Every screen containing a text input **must** use `react-native-keyboard-controller` for keyboard handling. Do **not** use React Native's `KeyboardAvoidingView`.

```tsx
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

export default function LoginScreen() {
  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
      bottomOffset={24}
    >
      {/* form content */}
    </KeyboardAwareScrollView>
  );
}
```

#### Rules

- Always use `KeyboardAwareScrollView` for screens containing text inputs.
- Never use React Native's `KeyboardAvoidingView`.
- Set `keyboardShouldPersistTaps="handled"` unless there's a specific reason not to.
- Use `contentContainerStyle={{ flexGrow: 1 }}` so content can fill the screen while remaining scrollable.
- Use `bottomOffset` when additional spacing is needed above the keyboard (for sticky buttons, tab bars, etc.).
- Forms should remain fully accessible while the keyboard is open, allowing every input and action button to be reached by scrolling.

### 4.6 Safe area — never hardcode insets

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Per-screen (preferred when you need fine-grained control)
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {/* … */}
    </View>
  );
}
```

Rules:

- Never hardcode `paddingTop: 44` or `paddingTop: 20` for status bar height
- Wrap the root layout in `<SafeAreaProvider>` from `react-native-safe-area-context`
- Use `useSafeAreaInsets()` in screens that need granular control
- Use `<SafeAreaView edges={["bottom"]}>` in modals/bottom sheets that only need bottom

### 4.7 Navigation — Expo Router

Expo Router uses file-based routing identical in philosophy to Next.js App Router.

```
app/
  _layout.tsx          ← root layout: fonts, providers, error boundary
  (tabs)/
    _layout.tsx        ← tab bar config
    index.tsx          ← home tab screen
    profile.tsx        ← profile tab screen
  product/
    [id].tsx           ← dynamic screen: useLocalSearchParams<{ id: string }>()
  (auth)/
    login.tsx
    register.tsx
  +not-found.tsx       ← 404 screen
```

**Typed navigation:**

```ts
// Always type your route params — never cast to unknown
import { useLocalSearchParams } from 'expo-router';
const { id } = useLocalSearchParams<{ id: string }>();

// Typed push
import { router } from 'expo-router';
router.push({ pathname: '/product/[id]', params: { id: product.id } });
```

**Header config in screen:**

```tsx
import { Stack } from 'expo-router';

export default function ProductScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Product', headerBackTitle: '' }} />
      {/* … */}
    </>
  );
}
```

Rules:

- Always use `router.push` / `router.replace` from `expo-router` — never React Navigation directly
- Never use `navigation.navigate` — that is the old paradigm; Expo Router uses href-style routing
- Type all route params with a generic — never `as any`
- Deep links are configured automatically by Expo Router — just define `scheme` in `app.json`

### 4.8 Render performance — memoisation

```
When to use React.memo():
  The component re-renders when its parent re-renders, its props haven't changed,
  AND the render is measurably expensive (FlashList items are the primary use case).

When NOT to use React.memo():
  By default. Premature memoisation adds comparison overhead and hides bugs.

useCallback: required for renderItem, keyExtractor, and any function prop passed to
  a memoised child — otherwise memo is useless.

useMemo: only for genuinely expensive derived values (filtering/sorting large arrays).
  Never for style objects — use StyleSheet.create() instead.
```

### 4.9 Animations — Reanimated only

```
✅ react-native-reanimated   → all animations, gestures, shared element transitions
❌ Animated from react-native → only acceptable when reanimated is unavailable
❌ setTimeout for animations  → never
```

Rules:

- Run animations on the UI thread: `useSharedValue` + `useAnimatedStyle`
- Never call `setState` inside a `worklet` — use `runOnJS` for cross-thread callbacks
- Gesture handling via `react-native-gesture-handler` (already included with Expo)
- Use `FadeIn`, `SlideInRight` layout animations from reanimated for screen transitions

### 4.10 Error handling and crash reporting

Every screen must be inside an error boundary:

```tsx
// app/_layout.tsx
import * as Sentry from '@sentry/react-native';

Sentry.init({ dsn: env.SENTRY_DSN });

export default Sentry.wrap(function RootLayout() {
  return <Slot />;
});
```

**Screen-level error boundary:**

```tsx
// components/ErrorBoundary.tsx — reusable
import { ErrorBoundary as ExpoErrorBoundary } from 'expo-router';

export function ScreenErrorBoundary({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExpoErrorBoundary
      fallback={({ error, retry }) => (
        <ErrorState message={error.message} onRetry={retry} />
      )}
    >
      {children}
    </ExpoErrorBoundary>
  );
}
```

Rules:

- Every screen is wrapped in an error boundary — Expo Router's `+error.tsx` handles route-level
- Sentry is initialised in `_layout.tsx` before any screen renders
- `console.error` in production is replaced by Sentry capture — never leave raw `console.log`

### 4.11 Environment variables — `expo-constants` + validation

```ts
// lib/env.ts
import Constants from 'expo-constants';
import { z } from 'zod';

const envSchema = z.object({
  apiBaseUrl: z.string().url(),
  sentryDsn: z.string().min(1),
  environment: z.enum(['development', 'staging', 'production']),
});

export const env = envSchema.parse(Constants.expoConfig?.extra);
```

In `app.config.ts`:

```ts
export default {
  extra: {
    apiBaseUrl: process.env.API_BASE_URL,
    sentryDsn: process.env.SENTRY_DSN,
    environment: process.env.APP_ENV ?? 'development',
  },
};
```

Rules:

- Never access `process.env.X` directly in components — always through `env.X`
- Never access `Constants.expoConfig?.extra` directly — always through `lib/env.ts`
- Secrets must never be included in `extra` — they are visible in the compiled bundle

### 4.12 OTA updates — EAS Update

For production apps with millions of users, ship bug fixes instantly without App Store review:

```ts
// app/_layout.tsx
import * as Updates from 'expo-updates';
import { useEffect } from 'react';

function useOTAUpdates() {
  useEffect(() => {
    async function checkUpdate() {
      if (!__DEV__ && Updates.isEnabled) {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      }
    }
    checkUpdate();
  }, []);
}
```

Rules:

- Check for updates at app start in the root layout
- Only reload for updates after `fetchUpdateAsync` completes — never reload mid-session
- Use EAS channels: `production`, `staging`, `development` — never push to production channel in CI without review

### 4.13 TypeScript strictness

- `"strict": true` in `tsconfig.json` — non-negotiable
- `"noUncheckedIndexedAccess": true` — prevents silent array out-of-bounds
- No `any` — replace with `unknown` + type guard or a proper type
- No non-null assertion (`!`) without an inline comment explaining why it is safe
- All component props interfaces named `<ComponentName>Props` and exported
- All service functions have explicit return types — never rely on `fetch().json()` inference
- Platform-specific types: `Platform.OS === "ios"` must be checked before using iOS-only APIs

### 4.14 Accessibility baseline

- `accessibilityRole` on every interactive element: `"button"`, `"link"`, `"image"`, etc.
- `accessibilityLabel` on every `<Pressable>` — the visual label text is not enough on its own
- `accessibilityHint` for non-obvious interactions ("Double tap to expand")
- `accessibilityState` for dynamic states: `{ disabled, checked, selected, busy, expanded }`
- Images that are purely decorative: `accessible={false}` + `importantForAccessibility="no"`
- Test with VoiceOver (iOS) and TalkBack (Android) — not just the simulator

### 4.15 Bundle size

- Use `expo-asset` for large static assets — they are excluded from the JS bundle
- Dynamic imports via `React.lazy()` for heavy screens not in the initial tab bar
- Avoid importing an entire library when only one function is needed
  (`import { format } from "date-fns"` not `import * as dateFns from "date-fns"`)
- Run `npx expo export --dump-sourcemap` and inspect with `source-map-explorer` for large chunks
- Enable Hermes on both platforms — it improves startup time and memory usage significantly

---

## 5 · Service Layer — Spec-Driven Types and Data

### 5.1 The single rule

**Types and data belong to the service layer. Nothing else.**

No type describing an API shape in a component. No mock array in a screen. No fetch call
outside a service file. The service layer is the contract between the mobile app and the
backend spec — when the spec changes, only the service layer changes; components are untouched.

### 5.2 Types file rules

```ts
// services/product/types.ts

/** Mirrors the spec's Product schema exactly. Name must match the spec. */
export interface Product {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  category: ProductCategory;
  stock: number;
}

export type ProductCategory = 'electronics' | 'apparel' | 'home';

export interface CreateProductPayload {
  title: string;
  price: number;
  categoryId: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

Rules:

- Type names must match the spec schema name exactly — no creative renaming
- `interface` over `type` alias where possible (better extension, better error messages)
- Spec enums → `type Union` not TypeScript `enum` (tree-shaken, zero runtime cost)
- Every type is exported — nothing private inside a types file
- Shared generics live in `services/types.ts`

### 5.3 Mock data file rules

```ts
// services/product/product.mock.ts
import type { Product } from './types';

export const mockProduct: Product = {
  id: 'prod_001',
  title: 'Wireless Headphones',
  price: 79.99,
  imageUrl: 'https://cdn.example.com/mock/headphones.jpg',
  category: 'electronics',
  stock: 42,
};

export const mockProducts: Product[] = [mockProduct];
```

Rules:

- Mock data **must fully satisfy the TypeScript type** — a spec change causes an
  immediate compile error in the mock, surfacing breakage before it ships
- No `faker`, no `Math.random()` — static only for deterministic tests
- Naming: `mock<Entity>` (singular), `mock<Entity>s` (plural)
- Never import a `*.mock.ts` from a component or production code
- A mock import in a screen is allowed only temporarily, with both lines mandatory:

```ts
// TODO: replace with getProducts() once API is live
// const { data } = await getProducts();
const data = mockProducts;
```

### 5.4 Service function rules

```ts
// services/product/product.service.ts
import type { Product, CreateProductPayload, PaginatedResponse } from './types';
import { ServiceError } from '@/services/errors';
import { env } from '@/lib/env';

export async function getProducts(
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<Product>> {
  const res = await fetch(
    `${env.apiBaseUrl}/products?page=${page}&pageSize=${pageSize}`,
    {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000), // 10s timeout — critical for mobile networks
    },
  );
  if (!res.ok) throw new ServiceError('getProducts', res.status);
  return res.json() as Promise<PaginatedResponse<Product>>;
}
```

Rules:

- One service file per domain entity / API resource
- Every function has an explicit return type — never `Promise<any>` or inferred
- Always set `AbortSignal.timeout` — mobile networks are unreliable; hanging requests kill UX
- All headers and base URL come from `lib/env.ts` — never hardcoded
- Throw `ServiceError` — callers never inspect raw HTTP status codes

### 5.5 Typed service errors

```ts
// services/errors.ts
export class ServiceError extends Error {
  constructor(
    public readonly operation: string,
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `${operation} failed with status ${status}`);
    this.name = 'ServiceError';
  }
}
```

Error boundaries and screen-level catch blocks handle `ServiceError` and render
status-specific messages (404 → "not found", 503 → "try again later") without leaking
HTTP internals into components.

---

## 6 · Execution Order

Proceed in this exact sequence to avoid cascading import errors:

```
PHASE 1 — Audit (read-only, zero writes)
  1a. Build icon/SVG duplication map
  1b. List all raw Pressable/TouchableOpacity/TextInput outside components/common/
  1c. List all screen violations (inline components, state, long JSX)
  1d. List all type/interface declarations outside service files
  1e. List all mock/stub data outside *.mock.ts
  1f. List all raw fetch calls outside service files
  1g. List all hardcoded colour/spacing values that have a theme token equivalent
  1h. List all React Native violations:
        · .map() on lists > 5 items (should be FlashList)
        · <Image> from react-native (should be expo-image)
        · inline style objects in JSX (should be StyleSheet.create)
        · hardcoded inset/padding values (should be safe area hooks)
        · screens missing KeyboardAwareScrollView around forms
        · Animated from react-native (should be reanimated)
        · TouchableOpacity / TouchableHighlight (should be Pressable)
        · console.log calls in production code
        · missing accessibilityRole / accessibilityLabel on interactive elements
        · missing AbortSignal.timeout on fetch calls

PHASE 2 — Icons
  2a. Create icons directory if absent
  2b. Create icon components using react-native-svg (deduplicated)
  2c. Update icons barrel

PHASE 3 — Service layer
  3a. Create services/errors.ts if absent
  3b. Create service directory per domain entity
  3c. Move types/interfaces to service types.ts files
  3d. Move mock data to *.mock.ts files
  3e. Wrap raw fetch calls in service functions with AbortSignal.timeout
  3f. Annotate temporary mock imports in screens with mandatory TODO comments

PHASE 4 — Common components (`components/common/`)
  4a. Create components/common/ directory if absent
  4b. Audit and replace raw Pressable/TextInput/TouchableOpacity with common components (§2.1)
  4c. Ensure all common components use forwardRef, displayName, accessibilityRole
  4d. Update components/common/index.ts barrel (export types alongside components)

PHASE 5 — Components (`components/`)
  5a. Confirm components/ directory exists (it should already)
  5b. Extract components from screen files (per §2.3–2.4 rules)
  5c. Ensure all components use components/common/ — never raw Pressable or TextInput
  5d. Move inline StyleSheet.create() into component-level const
  5e. Wrap event handlers in useCallback
  5f. Update components/index.ts barrel

PHASE 6 — Theme tokens
  6a. Replace hardcoded colour hex strings with theme token references (§3.3)
  6b. Replace hardcoded spacing numbers with spacing[N] (§3.3)
  6c. Replace hardcoded border radii with radius.* (§3.3)
  6d. Replace hardcoded font sizes with typography.* spreads (§3.3)
  6e. Add TODO comments for values with no matching token

PHASE 7 — Expo & RN optimisations
  7a. Replace .map() on long lists with FlashList (§4.1)
  7b. Move inline styles to StyleSheet.create() (§4.2)
  7c. Replace react-native <Image> with expo-image (§4.3)
  7d. Consolidate font loading in root _layout.tsx (§4.4)
  7e. Add KeyboardAvoidingView to all form screens (§4.5)
  7f. Replace hardcoded insets with useSafeAreaInsets() (§4.6)
  7g. Type all route params in Expo Router screens (§4.7)
  7h. Add React.memo + useCallback to FlashList renderItem (§4.8)
  7i. Replace Animated with reanimated (§4.9)
  7j. Add Sentry error boundaries (§4.10)
  7k. Centralise env vars in lib/env.ts (§4.11)
  7l. Add OTA update check in root layout (§4.12)
  7m. Add accessibility attributes (§4.14)
  7n. Remove console.log calls (§4.15)

PHASE 8 — Final review (verify, don't write)
  8a. No duplicate icon files
  8b. No raw Pressable / TextInput / TouchableOpacity outside components/common/
  8c. No components in components/ importing raw RN elements instead of components/common/
  8d. No UI logic or inline component definitions in screen files
  8e. No types or mocks outside the service layer
  8f. No hardcoded colour/spacing/radius values with a token equivalent
  8g. No raw fetch calls outside service files
  8h. All barrel exports up to date and alphabetical
  8i. No .map() on lists that can grow beyond 5 items
  8j. No inline style objects in JSX (only StyleSheet.create refs or dynamic-only exceptions)
  8k. Build passes: npx expo export / eas build
```

---

## 7 · Output Format

After completing the refactor, produce this summary:

```
## Refactor Summary

### Icons (N created, N deduplicated)
| File | Replaced Count | Used In |
|------|---------------|---------|
| SearchIcon.tsx | 6 | SearchBar.tsx, HomeScreen.tsx |

### Service Layer (N files)
| File | Types Moved | Mocks Moved | Fetches Wrapped |
|------|------------|------------|----------------|
| services/product/types.ts | Product, ProductCategory | — | — |
| services/product/product.mock.ts | — | mockProducts | — |
| services/product/product.service.ts | — | — | getProducts, getProductById |

### Primitives (N created or updated)
| File | Elements Replaced | Used In |
|------|------------------|---------|
| Button.tsx | 18× Pressable/TouchableOpacity | ProductCard, LoginScreen |
| AppTextInput.tsx | 9× TextInput | LoginForm, SearchBar, ProfileEdit |

### Composites (N extracted)
| File | Extracted From | Reused In |
|------|---------------|-----------|
| ProductCard.tsx | HomeScreen.tsx | home, search, wishlist |

### Token Replacements (N)
| Before | After | Count |
|--------|-------|-------|
| "#FFFFFF" | colors.inverse | 34 |
| 16 (padding) | spacing[4] | 28 |
| "#3B82F6" | colors.primary[500] | 12 |

### Expo & RN Fixes (N total)
- Lists: replaced N .map() with FlashList
- Images: replaced N <Image> with expo-image
- Styles: moved N inline style objects to StyleSheet.create
- Safe area: replaced N hardcoded insets with useSafeAreaInsets()
- Keyboard: added KeyboardAvoidingView to N form screens
- Primitives: replaced N raw Pressable/TouchableOpacity/TextInput
- Accessibility: added roles/labels to N interactive elements
- Errors: added Sentry boundaries to N screens

### TODOs Left
- [ ] color: "#FF6B35" in HeroBanner.tsx — no token match, add brand-accent-warm to theme
- [ ] getProducts mock in HomeScreen — uncomment real call when API is live
```

---

## 8 · Anti-Patterns — Never Do These

```
SERVICE LAYER
❌ Define an API type anywhere except a service types.ts
❌ Declare mock/stub data in a component, hook, or screen
❌ Import *.mock.ts from production component code
❌ Write fetch calls directly in a screen or component
❌ Rename spec types creatively — names must mirror the spec exactly
❌ Leave a mock import without both: a TODO comment AND the real call commented-out

ICONS
❌ Use <Image source={require(…)}> for icons — use react-native-svg components
❌ Create two icon files for the same SVG shape
❌ Name icons by appearance (TriangleDownIcon) — name by purpose (ChevronDownIcon)
❌ Hardcode a colour value inside an icon — receive color as a prop

COMMON COMPONENTS (`components/common/`)
❌ Use raw <Pressable> / <TouchableOpacity> outside components/common/
❌ Use raw <TextInput> outside components/common/AppTextInput.tsx
❌ Use <TouchableOpacity> or <TouchableHighlight> — always use <Pressable>
❌ Omit displayName on a forwardRef component — breaks React DevTools
❌ Put domain knowledge (Product, User types) inside components/common/
❌ StyleSheet.create() inside a component function — must be at module level

COMPONENTS (`components/`) & SCREENS
❌ Inline component definitions in a screen file
❌ useState for UI state in a screen — extract to components/ or a custom hook
❌ Raw <Pressable> or <TextInput> in components/ — use components/common/
❌ Duplicate a component file — add a variant prop instead

STYLING
❌ Inline style objects in JSX except for genuinely dynamic per-render values
❌ Hardcode hex colours, numeric padding, or border radii that exist in the theme
❌ Export a component default-only — always export named AND default

REACT NATIVE PERFORMANCE
❌ .map() on a list that can grow — use FlashList
❌ FlashList without estimatedItemSize — causes layout thrashing
❌ renderItem defined as an anonymous arrow function in JSX — breaks memo
❌ keyExtractor returning array index — causes incorrect key recycling
❌ react-native Animated — use react-native-reanimated
❌ setState inside a reanimated worklet — use runOnJS

REACT NATIVE CORRECTNESS
❌ Hardcoded status bar / safe area insets (paddingTop: 44, paddingTop: 20)
❌ <Image> from react-native — use expo-image
❌ Missing KeyboardAwareScrollView or what ever appropriate API the react-native-keyboard-controller library provides on screens with text inputs
❌ navigation.navigate() — use router.push() from expo-router
❌ Untyped useLocalSearchParams() — always provide the generic type parameter
❌ process.env.X directly — always go through lib/env.ts
❌ console.log in production code — use a logger or Sentry
❌ Missing accessibilityRole / accessibilityLabel on interactive elements
❌ fetch without AbortSignal.timeout — hanging requests on mobile networks are common
❌ Sentry not initialised before any screen renders
```
