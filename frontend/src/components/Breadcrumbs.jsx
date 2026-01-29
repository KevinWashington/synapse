import { Link, useLocation } from "react-router-dom";

function Breadcrumbs() {
  const location = useLocation();
  const paths = location.pathname.split("/").filter(Boolean);

  return (
    <nav className="text-sm text-muted-foreground">
      <ol className="flex items-center space-x-1">
        <li>
          <Link to="/" className="hover:underline">
            Início
          </Link>
        </li>
        {paths.map((segment, idx) => {
          const to = "/" + paths.slice(0, idx + 1).join("/");
          return (
            <li key={to} className="flex items-center">
              <span className="mr-1">/</span>
              <Link to={to} className="hover:underline capitalize">
                {decodeURIComponent(segment)}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
