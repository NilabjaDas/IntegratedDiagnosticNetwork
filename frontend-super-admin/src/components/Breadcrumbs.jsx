import React from "react";
import { Breadcrumb } from "antd";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const breadcrumbNameMap = {
  "/page1": "Page 1",
  "/page2": "Page 2",
  "/page3": "Page 3",
};

const Breadcrumbs = () => {
  const location = useLocation();
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  const pathSnippets = location.pathname.split("/").filter((i) => i);
  
  // Define link style based on theme
  const linkStyle = {
    color: theme === "dark" ? "#ffffff" : "rgba(0, 0, 0, 0.88)",
    transition: "color 0.3s"
  };

  const breadcrumbItems = pathSnippets.map((_, index) => {
    const url = `/${pathSnippets.slice(0, index + 1).join("/")}`;
    return (
      <Breadcrumb.Item key={url}>
        <Link to={url} style={linkStyle}>
          {breadcrumbNameMap[url] || "Page"}
        </Link>
      </Breadcrumb.Item>
    );
  });

  return (
    <Breadcrumb style={{ margin: 0 }}>
      <Breadcrumb.Item>
        <Link to="/" style={linkStyle}>
          Home
        </Link>
      </Breadcrumb.Item>
      {breadcrumbItems}
    </Breadcrumb>
  );
};

export default Breadcrumbs;