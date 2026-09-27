/**
 * Pure validation function for the Staff form wizard.
 * Returns an object of { fieldName: "error message" } for each invalid required field.
 *
 * @param {string} tab - "basic" | "employment" | "roles" | "account" | "details"
 * @param {object} formData - current form state
 * @param {boolean} isEditing - true when editing an existing staff member
 * @returns {object} errors map
 */
export function validateCurrentTab(tab, formData, isEditing) {
  const errors = {};

  if (tab === "basic") {
    if (!formData.name || !String(formData.name).trim()) {
      errors.name = "Name is required";
    }
  }

  if (tab === "employment") {
    if (!formData.staffType || !String(formData.staffType).trim()) {
      errors.staffType = "Staff type is required";
    }
    if (!formData.status || !String(formData.status).trim()) {
      errors.status = "Status is required";
    }
    if (!formData.basicPay || !String(formData.basicPay).trim()) {
      errors.basicPay = "Basic pay is required";
    }
    if (!formData.joinDate || !String(formData.joinDate).trim()) {
      errors.joinDate = "Join date is required";
    }
    if (formData.staffType === "CONTRACT") {
      if (!formData.contractStart || !String(formData.contractStart).trim()) {
        errors.contractStart = "Contract start date is required";
      }
      if (!formData.contractEnd || !String(formData.contractEnd).trim()) {
        errors.contractEnd = "Contract end date is required";
      }
    }
    if (formData.status === "TERMINATED" || formData.status === "RETIRED") {
      if (!formData.leaveDate || !String(formData.leaveDate).trim()) {
        errors.leaveDate = "Leave date is required";
      }
    }
  }

  if (tab === "roles") {
    if (!formData.isTeaching && !formData.isNonTeaching && !formData.isSupportingStaff) {
      errors.roles = "At least one role must be selected";
    }
  }

  if (tab === "account") {
    // If supporting staff, email and password are NOT required
    if (!formData.isSupportingStaff) {
      if (!formData.email || !String(formData.email).trim()) {
        errors.email = "Email is required";
      }
      if (!isEditing && (!formData.password || !String(formData.password).trim())) {
        errors.password = "Password is required";
      }
    }
  }

  Object.keys(errors).forEach((key) => {
    if (!errors[key]) delete errors[key];
  });
  return errors;
}
