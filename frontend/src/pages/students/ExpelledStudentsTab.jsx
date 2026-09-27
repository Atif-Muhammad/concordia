import React from "react";
import { StudentsTableTab } from "./StudentsTableTab";

export const ExpelledStudentsTab = (props) => {
  return <StudentsTableTab status="EXPELLED" {...props} />;
};
