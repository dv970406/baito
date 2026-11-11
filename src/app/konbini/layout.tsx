/**
 * KONBINI 직장 레이아웃.
 * data-workplace 로 accent 색 슬롯을 편의점 블루에 바인딩한다 (theme.css 2c 섹션).
 */
export default function KonbiniLayout({ children }: LayoutProps<"/konbini">) {
  return (
    <div data-workplace="konbini" className="min-h-dvh">
      {children}
    </div>
  );
}
