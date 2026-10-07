import { Outlet, useLocation } from "react-router-dom";
import Menu from "@components/Menu";
import { AppHeader } from "@/components/layout";
import { PageTitleProvider } from "@/context/pageTitleContext";
import { usePageTitleValue } from "@hooks/usePageTitleValue";

const Layout = () => {
  const location = useLocation();
  const isArticleWorkspace = /^\/projetos\/[^/]+\/artigos\/[^/]+/.test(location.pathname);

  return (
    <div className="flex min-h-screen bg-[#fbfcff] text-[#0f1734]">
      {!isArticleWorkspace ? <Menu /> : null}

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${isArticleWorkspace ? "" : "md:ml-[240px]"}`}>
        <PageTitleProvider>
          {!isArticleWorkspace ? (
            <HeaderBar />
          ) : null}

          <main
            className={
              isArticleWorkspace
                ? "h-screen flex-1 overflow-hidden p-0"
                : "min-w-0 flex-1 overflow-y-auto px-5 pb-8 pt-4 md:px-10 lg:px-14"
            }
          >
            <Outlet />
          </main>
        </PageTitleProvider>
      </div>
    </div>
  );
};

function HeaderBar() {
  const { title, backUrl, actions, badge, breadcrumbs } = usePageTitleValue();

  return (
    <AppHeader
      actions={actions || badge}
      backUrl={backUrl}
      breadcrumbs={breadcrumbs}
      title={title}
    />
  );
}

export default Layout;
