import React, { useEffect, useState } from "react";
import { Tabs, Layout, Typography, Button, message } from "antd";
import { FilePdfOutlined, SaveOutlined, CloudDownloadOutlined } from "@ant-design/icons";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { updateInstitution } from "../redux/apiCalls"; 
import BillingTemplateEditor from "../components/BillingTemplateEditor";
import TemplateLibrary from "../components/TemplateLibrary";

const { Title } = Typography;

const PageContainer = styled.div`
  padding: 24px;
  background: #fff;
  min-height: 100vh;
`;

const ConfigurationPage = () => {
  const dispatch = useDispatch();
  
  // Get current institution from Redux (ensure your login/init flow populates this)
  const { brandDetails } = useSelector((state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY]);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  useEffect(() => {
    if (brandDetails?.printTemplates) {
        setTemplates(brandDetails.printTemplates);
    }
  }, [brandDetails]);

  const handleSave = async () => {
    console.log(templates)
    setLoading(true);
    // Only send the fields we modified to avoid overwriting other stuff accidentally
    const res = await updateInstitution(dispatch, brandDetails.institutionId, { 
        printTemplates: templates 
    });
    setLoading(false);
    
    if (res.status === 200) message.success("Configuration Saved!");
    else message.error("Failed to save");
  };

  const updateTemplateList = (updatedTpl) => {
    let newTemplates = [...templates];
    const index = newTemplates.findIndex(t => t.templateId === updatedTpl.templateId);
    
    if (index > -1) {
        newTemplates[index] = updatedTpl;
    } else {
        newTemplates.push(updatedTpl);
    }
    
    // Handle "Default" logic: If new one is default, unset others of same type
    if (updatedTpl.isDefault) {
        newTemplates = newTemplates.map(t => 
            (t.type === updatedTpl.type && t.templateId !== updatedTpl.templateId) 
            ? { ...t, isDefault: false } 
            : t
        );
    }
    
    setTemplates(newTemplates);
  };

  return (
    <PageContainer>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <Title level={2}>Configuration</Title>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={loading}>
              Save All Changes
          </Button>
      </div>
      
      <Tabs defaultActiveKey="1" size="large" items={[
          {
            key: "1",
            label: <span><FilePdfOutlined /> My Templates</span>,
            children: <BillingTemplateEditor templates={templates} onUpdate={updateTemplateList} />,
          },
          {
            key: "2",
            label: <span><CloudDownloadOutlined /> Template Library</span>,
            children: <TemplateLibrary />,
          }
      ]} />
    </PageContainer>
  );
};

export default ConfigurationPage;