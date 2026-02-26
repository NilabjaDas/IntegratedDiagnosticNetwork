import React from "react";
import styled from "styled-components";
import { Typography, Card } from "antd";
import { useParams, Navigate } from "react-router-dom";

import TestManager from "../components/TestsManager/TestManager";
import MasterCatalog from "../components/TestsManager/MasterCatalog";
import PackageManager from "../components/TestsManager/PackageManager";

const { Title, Text } = Typography;

const PageContainer = styled.div`
  padding: 24px;
  min-height: 100vh;
  background-color: #f4f6f8;
`;

const TestsPage = () => {
  const { tab } = useParams(); // Reads "my-tests", "packages", etc., from the URL

  // Map the URL parameter to the correct component
  const renderContent = () => {
    switch (tab) {
      case 'my-tests': 
        return <TestManager />;
      case 'packages': 
        return <PackageManager />;
      case 'master-catalog': 
        return <MasterCatalog />;
      default: 
        // If they type a weird URL, send them back to my-tests
        return <Navigate to="/tests-management/my-tests" replace />;
    }
  };

  // Dynamically set the page title based on the URL
  const getTitle = () => {
    const titles = {
      'my-tests': 'My Tests (Price List)',
      'packages': 'Health Packages',
      'master-catalog': 'Master Catalog'
    };
    return titles[tab] || 'Tests Management';
  };

  return (
    <PageContainer>
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>{getTitle()}</Title>
        <Text type="secondary">Manage your laboratory tests, packages, and master catalog imports.</Text>
      </div>
      
      <Card bodyStyle={{ padding: '24px' }} style={{ borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', minHeight: '600px' }}>
        {renderContent()}
      </Card>
    </PageContainer>
  );
};

export default TestsPage;