import React from "react";
import { useParams, Navigate } from "react-router-dom";
import OrderManager from "../components/OrderManager/OrderManager";
import BlankPage from "./BlankPage";

const OrdersPage = () => {
  const { tab } = useParams();

  switch (tab) {
    case 'orders':
      return <OrderManager />;
    case 'reports':
      return <BlankPage title="Orders Reports" />;
    default:
      // Redirect invalid tabs safely back to the main manager
      return <Navigate to="/orders-management/orders" replace />;
  }
};

export default OrdersPage;