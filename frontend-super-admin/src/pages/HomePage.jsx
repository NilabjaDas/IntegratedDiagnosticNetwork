import { Button } from 'antd';
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { CLEAR_ALL_REDUCERS } from '../redux/actionTypes';
import { useDispatch } from 'react-redux';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 16px;
  margin-top: 24px;
`;

const StyledLink = styled(Link)`
  padding: 12px 24px;
  border: 1px solid #ccc;
  border-radius: 4px;
  text-decoration: none;
  color: #333;

  &:hover {
    background-color: #f0f0f0;
  }
`;

const HomePage = () => {

  const dispatch = useDispatch()




  return (
    <Container>
      <h1>Home Page</h1>
      <ButtonContainer>
        <StyledLink to="/page1">Page 1</StyledLink>
        <StyledLink to="/page2">Page 2</StyledLink>
        <StyledLink to="/page3">Page 3</StyledLink>
      </ButtonContainer>

    </Container>
  );
};

export default HomePage;
