import React from "react";
import { Breadcrumb } from "antd";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

// Optional: Map specific acronyms or weird terms that shouldn't just be Title Cased
const acronymMap = {
  'emr': 'EMR',
  'tv': 'TV',
  'id': 'ID'
};

// Helper function to format URL slugs into readable names
// e.g. "tests-management" -> "Tests Management"
const formatBreadcrumbName = (str) => {
  if (!str) return "";
  return str
    .split('-')
    .map(word => {
      const lowerWord = word.toLowerCase();
      // Check if it's a known acronym, otherwise Title Case it
      if (acronymMap[lowerWord]) return acronymMap[lowerWord];
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

const Breadcrumbs = () => {
  const location = useLocation();
  const theme = useSelector((state) => state[process.env.REACT_APP_UI_DATA_KEY]?.theme);
  
  // Split the pathname and remove empty strings (e.g. "/configuration/identity" -> ["configuration", "identity"])
  const pathSnippets = location.pathname.split("/").filter((i) => i);

  // Define link style based on theme
  const linkStyle = {
    color: theme === "dark" ? "#ffffff" : "rgba(0, 0, 0, 0.88)",
    transition: "color 0.3s"
  };

  const breadcrumbItems = pathSnippets.map((snippet, index) => {
    // Reconstruct the URL up to the current snippet
    const url = `/${pathSnippets.slice(0, index + 1).join("/")}`;
    
    // Format the snippet text
    const name = formatBreadcrumbName(snippet);
    
    return (
      <Breadcrumb.Item key={url}>
        <Link to={url} style={linkStyle}>
          {name}
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