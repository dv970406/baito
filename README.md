# pintokita

일본어 학습 웹 애플리케이션입니다.

## 기술 스택

| 구분 | 내용 |
| --- | --- |
| 프레임워크 | Next.js 16.4.5 (App Router, Turbopack) |
| UI | React 19.3 |
| 언어 | TypeScript 5 |
| 스타일 | Tailwind CSS 4 |
| 린트 | ESLint 9 (`eslint-config-next`) |
| 패키지 매니저 | pnpm |

## 시작하기

```bash
pnpm install
pnpm dev
```

브라우저에서 <http://localhost:3000> 을 열면 개발 서버를 확인할 수 있습니다.

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `pnpm dev` | 개발 서버 실행 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 빌드 결과물로 서버 실행 |
| `pnpm lint` | ESLint 검사 |

## 디렉토리 구조

```
src/
└── app/          # App Router 라우트, 레이아웃, 전역 스타일
public/           # 정적 파일
next.config.ts    # Next.js 설정 (Cache Components 활성화)
eslint.config.mjs # ESLint 설정
```

## 참고

- `next.config.ts`에 `cacheComponents: true`가 켜져 있습니다. 동적 데이터를 읽는 컴포넌트는 `<Suspense>`로 감싸거나 `'use cache'`로 캐싱해야 합니다.
- `AGENTS.md`는 `next dev` 실행 시 Next.js가 자동으로 생성·갱신하는 파일입니다.
