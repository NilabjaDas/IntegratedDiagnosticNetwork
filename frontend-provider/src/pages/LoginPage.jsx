import React, { useState, useEffect } from "react";
import { Form, Input, Button, Typography, Spin, theme as antTheme } from "antd";
import { UserOutlined, LockOutlined, LoadingOutlined } from "@ant-design/icons";
import { staffLogin } from "../redux/apiCalls";
import styled, { keyframes } from "styled-components";
import { Helmet } from "react-helmet";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;
const { useToken } = antTheme;

// --- Animations ---
const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
`;

// --- Styled Components ---
const PageContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #f0f2f5;
`;

// Left side image container
const ImageSide = styled.div`
  flex: 1.2;
  position: relative;
  background-image: url(${(props) => props.$bgUrl || "https://source.unsplash.com/random/1920x1080/?medical,hospital"});
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.3) 100%);
    backdrop-filter: blur(2px);
  }

  @media (max-width: 768px) {
    display: none;
  }
`;

const BrandOverlay = styled.div`
  position: relative;
  z-index: 2;
  color: white;
  text-align: center;
  padding: 40px;
  max-width: 500px;
  animation: ${fadeIn} 1s ease-out;
`;

// Right side login form container
const FormSide = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: #ffffff;
  padding: 40px;
  position: relative;
  box-shadow: -5px 0 25px rgba(0,0,0,0.05);
  z-index: 10;

  @media (max-width: 768px) {
    flex: 1;
    width: 100%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(10px);
  }
`;

const LoginCard = styled.div`
  width: 100%;
  max-width: 420px;
  padding: 40px;
  border-radius: 16px;
  animation: ${fadeIn} 0.6s ease-out;
  
  /* Optional: Glass effect if needed on mobile overlay */
  @media (max-width: 768px) {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: white;
  }
`;

const LogoContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
  
  img {
    max-height: 60px;
    max-width: 200px;
    object-fit: contain;
  }
`;

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { token: antToken } = useToken();

  const token = useSelector(
    (state) => state[process.env.REACT_APP_ACCESS_TOKEN_KEY]?.token
  );
  
  // Get brand details from Redux or fallback to defaults
  const institutionDetails = useSelector(
    (state) => state[process.env.REACT_APP_INSTITUTIONS_DATA_KEY]?.brandDetails
  ) || {};

  // Fallback theme colors if API data is missing
  const primaryColor = institutionDetails?.theme?.primaryColor || "#007bff";
  const logoBackground = institutionDetails?.theme?.logoBackground || "#ffffff";

  useEffect(() => {
    if (token) {
      navigate("/", { replace: true });
    }
  }, [token, navigate]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const res = await staffLogin(dispatch, values.username, values.password);
      if (res.status === 200) {
        toast.success("Welcome back!");
      } else {
        toast.error(res.message || "Invalid Credentials");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Helmet>
        <title>Login | {institutionDetails?.brandName || "Provider Portal"}</title>
      </Helmet>

      {/* Left Side: Hero Image & Branding */}
      <ImageSide $bgUrl={institutionDetails?.loginPageImgUrl}>
        <BrandOverlay>
            {institutionDetails?.institutionLogoUrl && (
                 <img 
                    src={institutionDetails.institutionLogoUrl} 
                    alt="Logo" 
                    style={{ 
                        height: 80, 
                        marginBottom: 20, 
                        background: "rgba(255,255,255,0.9)",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        boxShadow: "0 4px 15px rgba(0,0,0,0.2)"
                    }} 
                 />
            )}
          <Title level={1} style={{ color: "white", marginBottom: 10, fontWeight: 700 }}>
            {institutionDetails?.institutionName || "Integrated Diagnostic Network"}
          </Title>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px" }}>
            Secure Provider Portal Access
          </Text>
        </BrandOverlay>
      </ImageSide>

      {/* Right Side: Login Form */}
      <FormSide>
        <LoginCard>
          <LogoContainer>
            {/* Mobile Logo (or redundant logo for form context) */}
            {institutionDetails?.institutionLogoUrl ? (
                <div style={{ 
                    padding: '15px', 
                    borderRadius: '12px', 
                    background: logoBackground, // Use theme background 
                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                }}>
                    <img 
                        src={institutionDetails.institutionLogoUrl} 
                        alt="Brand Logo" 
                    />
                </div>
            ) : (
                <Title level={3} style={{color: primaryColor}}>Provider Login</Title>
            )}
          </LogoContainer>

          <div style={{ textAlign: "center", marginBottom: 30 }}>
            <Title level={2} style={{ marginBottom: 5 }}>Welcome Back</Title>
            <Text type="secondary">Please enter your credentials to sign in.</Text>
          </div>

          <Form
            name="login_form"
            layout="vertical"
            onFinish={onFinish}
            size="large"
            requiredMark={false}
          >
            <Form.Item
              name="username"
              label="Username"
              rules={[{ required: true, message: "Please enter your username" }]}
            >
              <Input 
                prefix={<UserOutlined style={{ color: "rgba(0,0,0,0.25)" }} />} 
                placeholder="e.g. dr.smith" 
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: "Please enter your password" }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: "rgba(0,0,0,0.25)" }} />}
                placeholder="••••••••"
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{
                  height: "48px",
                  fontSize: "16px",
                  fontWeight: "600",
                  borderRadius: "8px",
                  backgroundColor: primaryColor, // Dynamic Theme Color
                  borderColor: primaryColor,
                  marginTop: "10px",
                  boxShadow: `0 4px 12px ${primaryColor}40` // Add colored shadow
                }}
              >
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </Form.Item>

            <div style={{ textAlign: "center", marginTop: 24 }}>
              <Text type="secondary" style={{ fontSize: "13px" }}>
                Having trouble logging in? <a style={{ color: primaryColor }}>Contact Support</a>
              </Text>
            </div>
            
         
          </Form>
        </LoginCard>
        
        <div style={{ position: 'absolute', bottom: 20, textAlign: 'center', width: '100%' }}>
             <Text type="secondary" style={{ fontSize: '12px' }}>
                 © {new Date().getFullYear()} {"TechFloater"}. All rights reserved.
             </Text>
        </div>
      </FormSide>
    </PageContainer>
  );
};

export default Login;