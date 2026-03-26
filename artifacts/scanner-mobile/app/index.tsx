import { Redirect } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import Colors from "@/constants/colors";

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/home" />;
  }

  return <Redirect href="/login" />;
}
