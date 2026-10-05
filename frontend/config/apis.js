import axios from "axios";
import { format } from "date-fns";
import { formatLocalDate } from "../src/lib/utils";

// const base_url = "http://localhost:3003/api";
const base_url = "https://beams.hayatfoundation.org.pk/api";

// Attach token as fallback header in case cookies are blocked
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("concordia_token");
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

export const userWho = async () => {
  try {
    const response = await axios.get(`${base_url}/auth/user-who`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500, response: error.response };
  }
};
export const refreshTokens = async () => {
  try {
    const currentToken = localStorage.getItem("concordia_token");
    const response = await axios.post(`${base_url}/auth/refresh-tokens`, {
      refreshToken: currentToken
    }, {
      withCredentials: true,
    });
    if (response.data?.accessToken) {
      localStorage.setItem("concordia_token", response.data.accessToken);
    }
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500, response: error.response };
  }
};

export const getCurrentUser = async () => {
  try {
    return await userWho();
  } catch (error) {
    if (error.response?.status === 401 || error.status === 401) {
      try {
        await refreshTokens();
        return await userWho();
      } catch {
        return null;
      }
    }
    throw error;
  }
};

export const logout = async () => {
  try {
    localStorage.removeItem("concordia_token");
    const response = await axios.post(
      `${base_url}/auth/logout`,
      {},
      { withCredentials: true }
    );
    return response;
  } catch (error) {
    localStorage.removeItem("concordia_token");
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500, response: error.response };
  }
};
export const loginAdmin = async (data) => {
  try {
    const response = await axios.post(`${base_url}/auth/login`, data, {
      withCredentials: true,
    });
    if (response.data?.accessToken) {
      localStorage.setItem("concordia_token", response.data.accessToken);
    }
    return response;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500, response: error.response };
  }
};

// admin
export const getAdmins = async () => {
  try {
    const response = await axios.get(`${base_url}/admin/get/admins`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createAdmin = async (data) => {
  try {
    const response = await axios.post(`${base_url}/admin/create/admin`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateAdmin = async (adminID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/update/admin?adminID=${adminID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteAdmin = async (adminID) => {
  try {
    const response = await axios.delete(
      `${base_url}/admin/remove/admin?adminID=${adminID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED STAFF MANAGEMENT APIs
// ═══════════════════════════════════════════════════════════════════════════

export const getAllStaff = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.isTeaching !== undefined) params.append('isTeaching', filters.isTeaching);
    if (filters.isNonTeaching !== undefined) params.append('isNonTeaching', filters.isNonTeaching);
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);

    const response = await axios.get(`${base_url}/hr/staff?${params.toString()}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStaffById = async (id) => {
  try {
    const response = await axios.get(`${base_url}/hr/staff/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getTeacherProfile = async (staffId, email) => {
  if (staffId) {
    try {
      const res = await getStaffById(staffId);
      if (res) return res;
    } catch (e) {
      console.warn("Could not fetch staff by id, falling back to email search", e);
    }
  }
  if (email) {
    try {
      const staffList = await getAllStaff({ search: email });
      if (Array.isArray(staffList) && staffList.length > 0) {
        const matched =
          staffList.find(
            (s) => s.email?.toLowerCase() === email.toLowerCase()
          ) || staffList[0];
        if (matched?._id || matched?.id) {
          try {
            return await getStaffById(matched._id || matched.id);
          } catch {
            return matched;
          }
        }
        return matched;
      }
    } catch {
      // ignore
    }
  }
  return null;
};

export const createStaffAPI = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/staff`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateStaffAPI = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/hr/staff/${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteStaffAPI = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/hr/staff/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const reviseStaffSalaryAPI = async (id, data) => {
  try {
    const response = await axios.post(`${base_url}/hr/staff/${id}/salary-revision`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStaffSalaryHistoryAPI = async (id) => {
  try {
    const response = await axios.get(`${base_url}/hr/staff/${id}/salary-history`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStaffIdSettingsAPI = async () => {
  try {
    const response = await axios.get(`${base_url}/hr/staff-id-settings`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateStaffIdSettingsAPI = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/hr/staff-id-settings`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const previewStaffIdAPI = async ({ isTeaching, isNonTeaching, isSupportingStaff, joinDate }) => {
  try {
    const params = new URLSearchParams();
    params.append("isTeaching", String(Boolean(isTeaching)));
    params.append("isNonTeaching", String(Boolean(isNonTeaching)));
    if (isSupportingStaff !== undefined) params.append("isSupportingStaff", String(Boolean(isSupportingStaff)));
    if (joinDate) params.append("joinDate", joinDate);
    const response = await axios.get(`${base_url}/hr/staff-id-preview?${params.toString()}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY EMPLOYEE APIs (kept for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

export const getEmployeesByDept = async (dept, search) => {
  try {
    const response = await axios.get(`${base_url}/hr/get/employees?dept=${dept || ''}&search=${search || ''}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }

};

export const getPayrollSettings = async () => {
  try {
    const response = await axios.get(`${base_url}/hr/payroll-settings`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const updatePayrollSettings = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/hr/payroll-settings`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const getPayrollTemplates = async () => {
  try {
    const response = await axios.get(`${base_url}/hr/payroll-template`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getPayrollHistory = async (staffId, type) => {
  try {
    const response = await axios.get(`${base_url}/hr/payroll-history?staffId=${staffId}&type=${type}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createPayrollTemplate = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/payroll-template`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updatePayrollTemplate = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/hr/payroll-template?id=${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deletePayrollTemplate = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/hr/payroll-template?id=${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// department
export const getDepartmentNames = async () => {
  try {
    const response = await axios.get(`${base_url}/department/get/names`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteEmp = async (id) => {
  try {
    const response = await axios.delete(
      `${base_url}/hr/delete/employee?id=${id}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const getDepartments = async () => {
  try {
    const response = await axios.get(`${base_url}/department/get`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createDepartment = async (data) => {
  try {
    const response = await axios.post(`${base_url}/department/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateDepartment = async ({ depID, data }) => {
  try {
    const response = await axios.patch(
      `${base_url}/department/update?depID=${depID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteDepartment = async (depID) => {
  try {
    const response = await axios.delete(
      `${base_url}/department/remove?depID=${depID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// teacher
export const getTeacherNames = async () => {
  try {
    const response = await axios.get(`${base_url}/teacher/get/names`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getTeacherSubjects = async (teacherId, classId) => {
  try {
    const params = new URLSearchParams();
    if (teacherId) params.append("teacherId", teacherId);
    if (classId) params.append("classId", classId);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const response = await axios.get(`${base_url}/teacher/subjects${queryString}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getTeachers = async () => {
  try {
    const response = await axios.get(`${base_url}/teacher/get`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createTeacher = async (data) => {
  try {
    const response = await axios.post(`${base_url}/teacher/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateTeacher = async (teacherID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/teacher/update?teacherID=${teacherID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteTeacher = async (teacherID) => {
  try {
    const response = await axios.delete(
      `${base_url}/teacher/remove?teacherID=${teacherID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// mark teacher attendance
export const markTeacherAttendance = async (id, status, date) => {
  try {
    const response = await axios.patch(
      `${base_url}/admin/mark/teacher?id=${id}`,
      { status, date },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// student attendance
// Get teacher's assigned classes (requires authentication)
export const getTeacherClasses = async (teacherId) => {
  try {
    const params = teacherId ? `?teacherId=${teacherId}` : "";
    const { data } = await axios.get(`${base_url}/teacher/get/classes${params}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const fetchStudentAttendance = async (classId, sectionId, subjectId, date, sessionId) => {
  try {
    let url = `${base_url}/attendance/student/fetch?classId=${classId}&sectionId=${sectionId || ''}&subjectId=${subjectId}&date=${date}`;
    if (sessionId) url += `&sessionId=${sessionId}`;
    const response = await axios.get(url, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const updateStudentAttendance = async (data) => {
  try {
    const response = await axios.patch(
      `${base_url}/attendance/student/update`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteStudentAttendanceRecord = async ({ studentId, classId, sectionId, subjectId, date, attendanceId }) => {
  try {
    const response = await axios.delete(`${base_url}/attendance/student/record`, {
      params: { studentId, classId, sectionId, subjectId, date, attendanceId },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// programs
export const getProgramNames = async () => {
  try {
    const response = await axios.get(
      `${base_url}/academics/program/get/all/names`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getPrograms = async () => {
  try {
    const response = await axios.get(`${base_url}/academics/program/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createProgram = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/program/create`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateProgram = async (programID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/academics/program/update?programID=${programID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteProgram = async (programID) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/program/remove?programID=${programID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// classes
export const getClasseNames = async () => {
  try {
    const response = await axios.get(
      `${base_url}/academics/class/get/all/names`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getClasses = async () => {
  try {
    const { data } = await axios.get(`${base_url}/academics/class/get/all`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const createClass = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/class/create`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateClass = async (classID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/academics/class/update?classID=${classID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteClass = async (classID) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/class/remove?classID=${classID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// sections
export const getSectionNames = async () => {
  try {
    const response = await axios.get(
      `${base_url}/academics/section/get/all/names`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getSections = async () => {
  try {
    const response = await axios.get(`${base_url}/academics/section/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createSection = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/section/create`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateSection = async (secID, data) => {
  try {
    const id = secID;
    const response = await axios.patch(
      `${base_url}/academics/section/update?secID=${id}&sectionID=${id}&id=${id}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteSection = async (secID) => {
  try {
    const id = secID;
    const response = await axios.delete(
      `${base_url}/academics/section/remove?secID=${id}&sectionID=${id}&id=${id}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// academic sessions
export const getAcademicSessions = async () => {
  try {
    const response = await axios.get(`${base_url}/academics/session/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createAcademicSession = async (data) => {
  try {
    const response = await axios.post(`${base_url}/academics/session/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateAcademicSession = async (sessionID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/academics/session/update?sessionID=${sessionID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteAcademicSession = async (sessionID) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/session/remove?sessionID=${sessionID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// subjects
export const getSubjects = async () => {
  try {
    const response = await axios.get(`${base_url}/academics/subject/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const getClassSubjects = async (classId) => {
  try {
    const response = await axios.get(`${base_url}/academics/subject/get/all?classId=${classId}`, {
      withCredentials: true,
    });
    // Filter locally if backend doesn't support filtering by classId in get/all, 
    // but assuming we might need to filter.
    // Actually, let's check if get/all supports query params. 
    // If not, we filter client side or assume getSubjects returns all.
    // For now, let's assume we filter client side if the API returns all, or we use a new endpoint if available.
    // But wait, the backend `subject.controller.ts` isn't visible.
    // Let's just use getSubjects and filter in frontend for now to be safe, or add a specific call if needed.
    // Actually, I'll add a specific function that filters the result of getSubjects if needed, 
    // but better to just use getSubjects in the component and filter there.
    // However, for cleaner code, let's add it here.
    return response.data.filter(s => s.classId == classId);
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// Get subjects assigned to the logged-in teacher for a specific class
export const getTeacherSubjectsForClass = async (classId) => {
  try {
    const response = await axios.get(
      `${base_url}/teacher/subjects/by-class?classId=${classId}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const createSubject = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/subject/create`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateSubject = async (subID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/academics/subject/update?subID=${subID}&subjectID=${subID}&id=${subID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteSubject = async (subID) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/subject/remove?subID=${subID}&subjectID=${subID}&id=${subID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// subject-class mappings (SCM)
export const getSubjectClassMappings = async (sessionId) => {
  try {
    const url = sessionId
      ? `${base_url}/academics/scm/get/all?sessionId=${sessionId}`
      : `${base_url}/academics/scm/get/all`;
    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getSubjectsForClassWithAssignments = async (classId, sessionId, sectionId) => {
  try {
    let url = sessionId
      ? `${base_url}/academics/scm/subjects-for-class?classId=${classId}&sessionId=${sessionId}`
      : `${base_url}/academics/scm/subjects-for-class?classId=${classId}`;
    if (sectionId && sectionId !== "*") url += `&sectionId=${sectionId}`;
    const response = await axios.get(url, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const searchAcademicsStaff = async (q) => {
  try {
    const response = await axios.get(
      `${base_url}/academics/staff/search?q=${encodeURIComponent(q || "")}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const bulkAssignTeacherToClassSubjects = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/tcm/assign-with-subjects`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const createSubjectClassMapping = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/scm/create`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateSubjectClassMapping = async (scmID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/academics/scm/update?id=${scmID}&scmID=${scmID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteSubjectClassMapping = async (scmID) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/scm/remove?id=${scmID}&scmID=${scmID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// teacherSubjectMappings
export const getTeacherSubjectMappings = async () => {
  try {
    const response = await axios.get(`${base_url}/academics/tsm/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createTeacherSubjectMapping = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/tsm/create`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateTeacherSubjectMapping = async (tsmID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/academics/tsm/update?tsmID=${tsmID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteTeacherSubjectMapping = async (tsmID) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/tsm/remove?tsmID=${tsmID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// teacherClassMappings
export const getTeacherClassMappings = async (sessionId) => {
  try {
    const url = sessionId
      ? `${base_url}/academics/tcm/get/all?sessionId=${sessionId}`
      : `${base_url}/academics/tcm/get/all`;
    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createTeacherClassMappings = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/tcm/create`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateTeacherClassMappings = async (tcmID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/academics/tcm/update?tcmID=${tcmID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteTeacherClassMappings = async (tcmID) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/tcm/remove?tcmID=${tcmID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// timetables
export const getTimetables = async (sessionId, classId) => {
  try {
    const params = new URLSearchParams();
    if (sessionId && sessionId !== "all" && sessionId !== "none") params.append("sessionId", sessionId);
    if (classId && classId !== "all") params.append("classId", classId);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    const response = await axios.get(
      `${base_url}/academics/timetable/get/all${queryString}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const upsertTimetable = async (data) => {
  try {
    const response = await axios.post(
      `${base_url}/academics/timetable/upsert`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteTimetable = async (timetableId) => {
  try {
    const response = await axios.delete(
      `${base_url}/academics/timetable/remove?timetableId=${timetableId}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// assignments
export const getAssignments = async () => {
  try {
    const response = await axios.get(`${base_url}/assignment/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createAssignment = async (data) => {
  try {
    const response = await axios.post(`${base_url}/assignment/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateAssignment = async (assID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/assignment/update?assID=${assID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteAssignment = async (assID) => {
  try {
    const response = await axios.delete(
      `${base_url}/assignment/remove?assID=${assID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

///////////////////////////////////////////////////////////////////////////
// students //
export const getStudentById = async (studentId) => {
  try {
    const response = await axios.get(`${base_url}/student/${studentId}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const verifyStudentPublic = async (studentId) => {
  try {
    const response = await axios.get(`${base_url}/student/verify/${studentId}`);
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Student verification failed";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getLatestRollNumber = async (prefix) => {
  try {
    const { data } = await axios.get(`${base_url}/student/roll-number/latest?prefix=${encodeURIComponent(prefix)}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getLatestRollNumbersBatch = async (sessionId) => {
  try {
    const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
    const { data } = await axios.get(`${base_url}/student/roll-number/latest/batch${query}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getPassedOutStudents = async (programId, classId, sectionId, searchQuery, status, session, page, limit, sessionId, summary = false) => {
  try {
    const limitParam = limit !== undefined && limit !== null && limit !== '' ? limit : 20;
    const summaryParam = summary ? '&summary=true' : '';
    const response = await axios.get(`${base_url}/student/get/all/passout?programId=${programId || ''}&classId=${classId || ''}&sectionId=${sectionId || ''}&searchQuery=${searchQuery || ''}&status=${status || ''}&session=${session || ''}&sessionId=${sessionId || ''}&page=${page || 1}&limit=${limitParam}${summaryParam}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const getStudents = async (programId, classId, sectionId, searchQuery, status, session, page, limit, startDate, endDate, sessionId, summary = false, gender = '', fields = '') => {
  try {
    if (typeof programId === 'object' && programId !== null) {
      const params = new URLSearchParams();
      Object.entries(programId).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          params.append(k, v);
        }
      });
      const response = await axios.get(`${base_url}/student/get/all${params.toString() ? '?' + params.toString() : ''}`, {
        withCredentials: true,
      });
      return response.data;
    }

    const limitParam = limit !== undefined && limit !== null && limit !== '' ? limit : 20;
    const summaryParam = summary ? '&summary=true' : '';
    const genderParam = gender && gender !== 'all' ? `&gender=${encodeURIComponent(gender)}` : '';
    const fieldsParam = fields ? `&fields=${encodeURIComponent(fields)}` : '';
    const response = await axios.get(`${base_url}/student/get/all?programId=${programId || ''}&classId=${classId || ''}&sectionId=${sectionId || ''}&searchQuery=${searchQuery || ''}&status=${status || ''}&session=${session || ''}&sessionId=${sessionId || ''}&page=${page || 1}&limit=${limitParam}&startDate=${startDate || ''}&endDate=${endDate || ''}${summaryParam}${genderParam}${fieldsParam}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const createStudent = async (data) => {
  try {
    const response = await axios.post(`${base_url}/student/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const updateStudent = async (studentID, data) => {
  try {
    const response = await axios.patch(
      `${base_url}/student/update?studentID=${studentID}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
export const deleteStudent = async (studentID) => {
  try {
    const response = await axios.delete(
      `${base_url}/student/remove?studentID=${studentID}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// promote
export const promoteStudents = async (studentID, forcePromote = false, targetClassId = null, targetSectionId = null, targetProgramId = null, targetSession = null, targetSessionId = null) => {
  try {
    let url = `${base_url}/student/promote?studentID=${studentID}`;
    if (forcePromote) url += '&forcePromote=true';
    if (targetClassId) url += `&targetClassId=${targetClassId}`;
    if (targetSectionId) url += `&targetSectionId=${targetSectionId}`;
    if (targetProgramId) url += `&targetProgramId=${targetProgramId}`;
    if (targetSession) url += `&targetSession=${encodeURIComponent(targetSession)}`;
    if (targetSessionId) url += `&targetSessionId=${targetSessionId}`;

    const response = await axios.patch(
      url,
      {},
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
// demote
export const demoteStudents = async (studentID) => {
  try {
    const response = await axios.patch(
      `${base_url}/student/demote?studentID=${studentID}`,
      {},
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
// passout
export const passoutStudents = async (studentID) => {
  try {
    const response = await axios.patch(
      `${base_url}/student/passout?studentID=${studentID}`,
      {},
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// expel
export const expelStudents = async (studentID, reason) => {
  try {
    const response = await axios.patch(
      `${base_url}/student/expel?studentID=${studentID}`,
      { reason },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// struck-off
export const struckOffStudents = async (studentID, reason) => {
  try {
    const response = await axios.patch(
      `${base_url}/student/struck-off?studentID=${studentID}`,
      { reason },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// rejoin
export const rejoinStudent = async (studentID, reason, details = {}) => {
  try {
    const response = await axios.patch(
      `${base_url}/student/rejoin?studentID=${studentID}`,
      { reason, ...details },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// Search students by name or roll number
export const searchStudents = async (query) => {
  try {
    const { data } = await axios.get(`${base_url}/student/search?searchFor=${encodeURIComponent(query)}`, {
      withCredentials: true,
    });
    return data.students || data || [];
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// will return attendance, if not available then return students of the class/section
export const getClasseOrSectionAttendance = async (id, date, fetchFor, subjectId) => {
  try {
    const params = new URLSearchParams();
    if (id) params.append("id", id);
    if (date) params.append("date", date);
    if (fetchFor) params.append("fetchFor", fetchFor);
    if (subjectId && subjectId !== "undefined" && subjectId !== "null" && subjectId !== "all") {
      params.append("subjectId", subjectId);
    }
    const response = await axios.get(
      `${base_url}/teacher/get/class/students/attendance?${params.toString()}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const updateAttendance = async (classId, sectionId, subjectId, date, payload) => {
  try {
    const params = new URLSearchParams({ classId, date });

    if (sectionId) params.append("sectionId", sectionId);
    if (subjectId) params.append("subjectId", subjectId);

    const { data } = await axios.patch(
      `${base_url}/teacher/update/class/students/attendance?${params.toString()}`,
      payload,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};


export const getWeeklyMonthlyReport = async (reportType, reportClass) => {
  try {
    const today = new Date();
    const startDate = new Date(today);

    // Calculate start date based on report type
    if (reportType === "weekly") {
      startDate.setDate(today.getDate() - 7);
    } else {
      startDate.setMonth(today.getMonth() - 1);
    }

    const start = startDate.toISOString().split("T")[0];
    const end = today.toISOString().split("T")[0];

    // Build URL dynamically
    const url = `${base_url}/attendance/report?start=${start}&end=${end}${reportClass && reportClass !== "all" ? `&classId=${reportClass}` : ""
      }`;

    const { data } = await axios.get(url, { withCredentials: true });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// teacher attendance
export const getTeacherAttendance = async (date) => {
  try {
    const response = await axios.get(`${base_url}/admin/get/teacher/attendance?date=${date}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// leaves
export const getLeaves = async ({ pageParam = 1, type = "ALL", month } = {}) => {
  try {
    const { data } = await axios.get(`${base_url}/attendance/leaves/get`, {
      params: {
        page: pageParam,
        limit: 100,
        ...(type && type !== "ALL" ? { type } : {}),
        ...(month ? { month } : {}),
      },
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createLeave = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/attendance/leaves/create`,
      payload,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateLeave = async (id, status) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/attendance/leaves/update?id=${id}`,
      { status },
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteLeave = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/attendance/leave/${id}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// search student
export const searchStudent = async (searchQuery) => {
  console.log(searchQuery)
  try {
    const { data } = await axios.get(
      `${base_url}/student/search?searchFor=${searchQuery}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


//////////////////////////////
// hr
// employees
export const createEmp = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/hr/create/employee`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateEmp = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hr/update/employee?id=${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const delEmp = async (empId) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/hr/delete/employees?empId=${empId}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Attendance Report
export const getAttendanceReport = async (start, end, classId, sectionId, sessionId) => {
  try {
    const params = new URLSearchParams({ start, end });
    if (classId) params.append('classId', classId);
    if (sectionId) params.append('sectionId', sectionId);
    if (sessionId) params.append('sessionId', sessionId);

    const response = await axios.get(
      `${base_url}/attendance/report?${params.toString()}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const getEmp = async (dept) => {
  try {
    const url = dept ? `${base_url}/hr/get/employees?dept=${dept}` : `${base_url}/hr/get/employees`;
    const { data } = await axios.get(
      url,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};



//////////////////////////////////////////////////////
// front office
export const createInquiry = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/front-office/create/inquiry`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateInquiry = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/front-office/update/inquiry?id=${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const addInquiryRemark = async (id, remark) => {
  try {
    const { data } = await axios.post(
      `${base_url}/front-office/inquiry/${id}/remark`,
      { remark },
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createInquiryFollowUp = async (inquiryId, payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/front-office/inquiry/${inquiryId}/follow-up`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateInquiryFollowUp = async (inquiryId, followUpId, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/front-office/inquiry/${inquiryId}/follow-up/${followUpId}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteInquiryFollowUp = async (inquiryId, followUpId) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/front-office/inquiry/${inquiryId}/follow-up/${followUpId}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const delInquiry = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/front-office/delete/inquiry?id=${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getInquiries = async (programId, page = 1, limit = 10) => {
  try {
    const { data } = await axios.get(
      `${base_url}/front-office/get/inquiries?programId=${programId || ""}&page=${page}&limit=${limit}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// visitors
export const createVisitor = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/front-office/create/visitor`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateVisitor = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/front-office/update/visitor?id=${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// fee management
// fee heads
export const createFeeHead = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee-management/head/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getFeeHeads = async () => {
  try {
    const response = await axios.get(`${base_url}/fee-management/head/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateFeeHead = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/fee-management/head/update?id=${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFeeHead = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/fee-management/head/delete?id=${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// fee structures
export const createFeeStructure = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee-management/structure/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getFeeStructures = async () => {
  try {
    const response = await axios.get(`${base_url}/fee-management/structure/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateFeeStructure = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/fee-management/structure/update?id=${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFeeStructure = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/fee-management/structure/delete?id=${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// fee challans
export const createFeeChallan = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee-management/challan/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getFeeChallans = async (filters = {}, options = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const url = `${base_url}/fee-management/challan/get/all${params.toString() ? '?' + params.toString() : ''}`;
    const response = await axios.get(url, {
      withCredentials: true,
      signal: options?.signal,
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || error?.name === 'CanceledError' || error?.name === 'AbortError') {
      return { data: [], meta: {} };
    }
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getBulkChallans = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const url = `${base_url}/fee-management/challan/bulk${params.toString() ? '?' + params.toString() : ''}`;
    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


export const updateFeeChallan = async (id, data) => {
  console.log(id, data);
  try {
    const response = await axios.patch(`${base_url}/fee-management/challan/update?id=${id}`, data, {
      withCredentials: true,
    });
    console.log(response)
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFeeChallan = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/fee-management/challan/delete?id=${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStudentFeeHistory = async (studentId, type = "") => {
  try {
    const response = await axios.get(
      `${base_url}/fee-management/challan/history?studentId=${studentId}${type ? `&type=${type}` : ""}&limit=1000`,
      { withCredentials: true }
    );
    const result = response.data;
    if (Array.isArray(result)) return result;
    if (Array.isArray(result?.data)) return result.data;
    return [];
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


export const createExtraChallanDedicated = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee-management/extra-challan/create`, data, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


export const getStudentFeeSummary = async (studentId) => {
  try {
    const response = await axios.get(`${base_url}/fee-management/student/summary?studentId=${studentId}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getStudentArrears = async (studentId) => {
  try {
    const response = await axios.get(`${base_url}/fee-management/student/arrears?studentId=${studentId}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getInstallmentPlans = async (filters = {}, options = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });

    const url = `${base_url}/fee-management/installment-plans${params.toString() ? '?' + params.toString() : ''}`;
    const response = await axios.get(url, {
      withCredentials: true,
      signal: options?.signal,
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || error?.name === 'CanceledError' || error?.name === 'AbortError') {
      return null;
    }
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const generateChallansFromPlan = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee-management/challan/generate-from-plan`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getVisitors = async (month) => {
  try {
    const url = month
      ? `${base_url}/front-office/get/visitors?month=${month}`
      : `${base_url}/front-office/get/visitors`;
    const { data } = await axios.get(
      url,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const delVisitor = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/front-office/delete/visitor?id=${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


// complaints
export const createComplaint = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/front-office/create/complaint`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateComplaint = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/front-office/update/complaint?id=${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const delComplaint = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/front-office/delete/complaint?id=${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getComplaints = async (date) => {
  try {
    let url = `${base_url}/front-office/get/complaints`;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      url += `?start=${start.toISOString()}&end=${end.toISOString()}`;
    }
    const { data } = await axios.get(
      url,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getMyComplaints = async (month, year) => {
  try {
    const params = new URLSearchParams();
    if (month) params.append("month", month);
    if (year) params.append("year", year);

    const { data } = await axios.get(
      `${base_url}/front-office/get/my-complaints?${params.toString()}`,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const addComplaintRemark = async (complaintId, payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/front-office/complaint/${complaintId}/remark`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


// complaints
export const createContact = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/front-office/create/contact`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateContact = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/front-office/update/contact?id=${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const delContact = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/front-office/delete/contact?id=${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getContacts = async () => {
  try {
    const { data } = await axios.get(
      `${base_url}/front-office/get/contacts`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};



// exams
export const createExam = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/exams`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateExam = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/exams/${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const delExam = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/exams/${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getExams = async (sessionId) => {
  try {
    const params = new URLSearchParams();
    const cleanSessionId =
      typeof sessionId === 'string' || typeof sessionId === 'number'
        ? String(sessionId)
        : typeof sessionId === 'object' && sessionId !== null && !sessionId.queryKey && !sessionId.signal
        ? String(sessionId.id || sessionId._id || sessionId.sessionId || '')
        : undefined;

    if (
      cleanSessionId &&
      cleanSessionId !== 'all' &&
      cleanSessionId !== 'undefined' &&
      cleanSessionId !== 'null' &&
      cleanSessionId !== '[object Object]'
    ) {
      params.append('sessionId', cleanSessionId);
    }
    const { data } = await axios.get(
      `${base_url}/exams${params.toString() ? '?' + params.toString() : ''}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


// marks
export const createMarks = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/exams/marks`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const bulkCreateMarks = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/exams/marks/bulk`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateMarks = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/exams/marks/${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const delMarks = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/exams/marks/delete?id=${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getMarks = async (examId, sectionId, sessionId) => {
  try {
    const validExamId =
      examId && typeof examId === "object"
        ? (examId.queryKey ? undefined : examId.id || examId._id || undefined)
        : examId;
    const validSectionId =
      sectionId && typeof sectionId === "object"
        ? (sectionId.queryKey ? undefined : sectionId.id || sectionId._id || undefined)
        : sectionId;
    const validSessionId =
      sessionId && typeof sessionId === "object"
        ? (sessionId.queryKey ? undefined : sessionId.id || sessionId._id || undefined)
        : sessionId;

    const params = new URLSearchParams();
    if (validExamId && validExamId !== "*" && validExamId !== "all") params.append('examId', validExamId);
    if (validSectionId && validSectionId !== "*" && validSectionId !== "all") params.append('sectionId', validSectionId);
    if (validSessionId && validSessionId !== "*" && validSessionId !== "all" && validSessionId !== "__all__") params.append('sessionId', validSessionId);

    const url = params.toString()
      ? `${base_url}/exams/marks?${params.toString()}`
      : `${base_url}/exams/marks`;

    const { data } = await axios.get(
      url,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// results
export const createResult = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/exams/result/create`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const updateResult = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/exams/result/update?id=${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const delResult = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/exams/result/delete?id=${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};
export const getResults = async (sessionId) => {
  const validSessionId =
    sessionId && typeof sessionId === "object"
      ? (sessionId.queryKey ? undefined : sessionId.id || sessionId._id || undefined)
      : sessionId;

  const params = new URLSearchParams();
  if (validSessionId && validSessionId !== "*" && validSessionId !== "all" && validSessionId !== "__all__") {
    params.append('sessionId', validSessionId);
  }
  try {
    const { data } = await axios.get(
      `${base_url}/exams/result/all${params.toString() ? '?' + params.toString() : ''}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStudentResult = async (studentId, examId) => {
  try {
    const { data } = await axios.get(
      `${base_url}/exams/result/student?studentId=${studentId}&examId=${examId}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const generateResults = async (examId, classId) => {
  try {
    const params = new URLSearchParams();
    params.append('examId', examId);
    if (classId) params.append('classId', classId);

    const { data } = await axios.post(
      `${base_url}/exams/result/generate?${params.toString()}`,
      {},
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Positions APIs
export const getPositions = async (examId, classId) => {
  try {
    const validExamId =
      examId && typeof examId === "object"
        ? (examId.queryKey ? undefined : examId.id || examId._id || undefined)
        : examId;
    const validClassId =
      classId && typeof classId === "object"
        ? (classId.queryKey ? undefined : classId.id || classId._id || undefined)
        : classId;

    const params = new URLSearchParams();
    if (validExamId && validExamId !== "*" && validExamId !== "all") params.append('examId', validExamId);
    if (validClassId && validClassId !== "*" && validClassId !== "all") params.append('classId', validClassId);

    const url = params.toString()
      ? `${base_url}/exams/positions/all?${params.toString()}`
      : `${base_url}/exams/positions/all`;

    const { data } = await axios.get(url, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const generatePositions = async (examId, classId) => {
  try {
    const params = new URLSearchParams();
    params.append('examId', examId);
    if (classId) params.append('classId', classId);

    const { data } = await axios.post(
      `${base_url}/exams/positions/generate?${params.toString()}`,
      {},
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updatePosition = async (id, payload) => {
  try {
    const { data } = await axios.put(
      `${base_url}/exams/positions/update?id=${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const delPosition = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/exams/positions/delete?id=${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ==========================================
// STUDENT ATTENDANCE & RESULTS APIs
// ==========================================

// Get attendance records for a specific student
export const getStudentAttendance = async (studentId) => {
  try {
    const { data } = await axios.get(
      `${base_url}/student/attendance/${studentId}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Get exam results for a specific student
export const getStudentResults = async (studentId) => {
  try {
    const { data } = await axios.get(
      `${base_url}/student/results/${studentId}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Generate attendance report for a specific student
export const generateAttendanceReport = async (studentId) => {
  try {
    const { data } = await axios.get(
      `${base_url}/student/attendance-report/${studentId}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Generate result report for a specific student
export const generateResultReport = async (studentId) => {
  try {
    const { data } = await axios.get(
      `${base_url}/student/result-report/${studentId}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getDefaultReportCardTemplate = async () => {
  try {
    const { data } = await axios.get(
      `${base_url}/configuration/report-card-templates/default`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOSTEL - REGISTRATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getHostelRegistrations = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.type) params.append('type', filters.type);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));
    const { data } = await axios.get(`${base_url}/hostel/registrations?${params.toString()}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelRegistrationById = async (id) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/registrations/${id}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createHostelRegistration = async (registrationData) => {
  try {
    const { data } = await axios.post(
      `${base_url}/hostel/registrations`,
      registrationData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateHostelRegistration = async (id, registrationData) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hostel/registrations/${id}`,
      registrationData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteHostelRegistration = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/hostel/registrations/${id}`,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const terminateHostelRegistration = async (id, reason) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hostel/registrations/${id}/terminate`,
      { reason },
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const withdrawHostelRegistration = async (id) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hostel/registrations/${id}/withdraw`,
      {},
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const readmitHostelRegistration = async (id) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hostel/registrations/${id}/readmit`,
      {},
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelRegistrationHistory = async (id) => {
  try {
    const { data } = await axios.get(
      `${base_url}/hostel/registrations/${id}/history`,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOSTEL - ROOMS & ALLOCATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getRooms = async () => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/rooms`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createRoom = async (roomData) => {
  try {
    const { data } = await axios.post(`${base_url}/hostel/rooms`, roomData, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateRoom = async (id, roomData) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hostel/rooms/${id}`,
      roomData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteRoom = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/hostel/rooms/${id}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const allocateRoom = async (allocationData) => {
  try {
    const { data } = await axios.post(
      `${base_url}/hostel/allocations`,
      allocationData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deallocateStudent = async (allocationId) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/hostel/allocations/${allocationId}`,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOSTEL - EXPENSES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getHostelExpenses = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { data } = await axios.get(`${base_url}/hostel/expenses${query}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createHostelExpense = async (expenseData) => {
  try {
    const { data } = await axios.post(
      `${base_url}/hostel/expenses`,
      expenseData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateHostelExpense = async (id, expenseData) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hostel/expenses/${id}`,
      expenseData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteHostelExpense = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/hostel/expenses/${id}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOSTEL - INVENTORY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getInventoryItems = async () => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/inventory`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createInventoryItem = async (itemData) => {
  try {
    const { data } = await axios.post(
      `${base_url}/hostel/inventory`,
      itemData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateInventoryItem = async (id, itemData) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/hostel/inventory/${id}`,
      itemData,
      { withCredentials: true }
    );
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteInventoryItem = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/hostel/inventory/${id}`, {
      withCredentials: true,
    });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// School Inventory
export const getSchoolInventoryItems = async (params) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const url = `${base_url}/inventory/items${queryParams ? `?${queryParams}` : ''}`;
    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const getSchoolInventoryItem = async (id) => {
  try {
    const response = await axios.get(`${base_url}/inventory/items/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const createSchoolInventoryItem = async (data) => {
  try {
    const response = await axios.post(`${base_url}/inventory/items`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const updateSchoolInventoryItem = async ({ id, data }) => {
  try {
    const response = await axios.patch(
      `${base_url}/inventory/items/${id}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteSchoolInventoryItem = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/inventory/items/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

// Inventory Expenses
export const getInventoryExpenses = async () => {
  try {
    const response = await axios.get(`${base_url}/inventory/expenses`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const getInventoryExpensesByItem = async (itemId) => {
  try {
    const response = await axios.get(`${base_url}/inventory/expenses/item/${itemId}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const createInventoryExpense = async (data) => {
  try {
    const response = await axios.post(`${base_url}/inventory/expenses`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const updateInventoryExpense = async ({ id, data }) => {
  try {
    const response = await axios.patch(
      `${base_url}/inventory/expenses/${id}`,
      data,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteInventoryExpense = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/inventory/expenses/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";

    throw { message, status: error.response?.status || 500 };
  }
};
// Fee Reports
export const getRevenueOverTime = async ({ period }) => {
  try {
    const response = await axios.get(`${base_url}/fee-management/reports/revenue-over-time?period=${period}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const getClassCollectionStats = async ({ period }) => {
  try {
    const response = await axios.get(`${base_url}/fee-management/reports/class-collection?period=${period}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const getFeeCollectionSummary = async ({ period, sessionId }) => {
  try {
    const params = new URLSearchParams({ period });
    if (sessionId && sessionId !== 'all') params.append('sessionId', sessionId);
    const response = await axios.get(`${base_url}/fee-management/reports/collection-summary?${params.toString()}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};



// Leave Management
export const getLeaveSheet = async (month, type) => {
  try {
    const response = await axios.get(`${base_url}/hr/leave-sheet`, {
      params: { month, type },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const upsertLeave = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/leave`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteStaffLeave = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/hr/staff-leaves/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const getStaffLeaveBalance = async (staffId, month) => {
  try {
    const url = month
      ? `${base_url}/hr/staff-leave-balance/${staffId}?month=${month}`
      : `${base_url}/hr/staff-leave-balance/${staffId}`;
    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const getStaffAttendanceHistory = async (staffId, month) => {
  try {
    const url = month
      ? `${base_url}/hr/staff/${staffId}/attendance?month=${month}`
      : `${base_url}/hr/staff/${staffId}/attendance`;
    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const toggleLockStaffLeave = async (id, locked) => {
  try {
    const response = await axios.patch(`${base_url}/hr/staff-leaves/${id}/lock`, { locked }, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateStaffLeaveStatus = async (id, status) => {
  try {
    const response = await axios.patch(`${base_url}/hr/staff-leaves/${id}/status`, { status }, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

// Employee Attendance
const normalizeStaffAttendanceRows = (rows, date) => {
  if (!Array.isArray(rows)) return [];

  const mapped = rows.map((row) => {
    // New flattened backend shape — already has row.staff
    if (row?.staff) {
      return {
        ...row,
        staffId: String(row.staffId || row.staff.id || row.staff._id || ""),
      };
    }

    // Legacy shape: direct staff row with nested attendance[]
    const existing = Array.isArray(row?.attendance) ? row.attendance[0] : null;
    return {
      id: existing?.id ?? null,
      staffId: String(row?.id || row?._id || ""),
      staff: {
        id: row?.id || row?._id,
        name: row?.name,
        designation: row?.designation,
        specialization: row?.specialization,
        empDepartment: row?.empDepartment,
        department: row?.department,
        isTeaching: row?.isTeaching,
        isNonTeaching: row?.isNonTeaching,
        photo_url: row?.photo_url,
      },
      date: existing?.date ?? date,
      status: existing?.status ?? null,
      leaveType: existing?.leaveType ?? null,
      markedBy: existing?.markedBy ?? null,
      markedAt: existing?.markedAt ?? null,
      generatedAt: existing?.generatedAt ?? null,
      generatedById: existing?.generatedById ?? null,
      generatedByName: existing?.generatedByName ?? null,
      notes: existing?.notes ?? "",
      autoGenerated: existing?.autoGenerated ?? false,
      admin: existing?.admin ?? null,
      isApprovedLeave: existing?.isApprovedLeave ?? false,
    };
  });

  // Deduplicate: keep one row per staff, preferring rows with real attendance data.
  const byStaff = new Map();
  const score = (r) => {
    let s = 0;
    if (r?.id) s += 4;
    if (r?.isApprovedLeave) s += 3;
    if (r?.generatedAt) s += 3;
    if (r?.markedAt) s += 2;
    if (r?.autoGenerated === false) s += 1;
    return s;
  };

  for (const r of mapped) {
    const sid = String(r?.staff?.id ?? r?.staff?._id ?? r?.staffId ?? r?.id ?? "");
    if (!sid) continue;
    const prev = byStaff.get(sid);
    if (!prev || score(r) > score(prev)) byStaff.set(sid, r);
  }

  return Array.from(byStaff.values());
};

export const getStaffAttendance = async (date, role = 'all') => {
  try {
    const response = await axios.get(`${base_url}/hr/staff-attendance`, {
      params: { date, role },
      withCredentials: true,
    });
    return normalizeStaffAttendanceRows(response.data, date);
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const markStaffAttendance = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/staff-attendance`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteStaffAttendanceRecord = async (staffIdOrPayload, dateArg) => {
  try {
    const payload = typeof staffIdOrPayload === "object"
      ? staffIdOrPayload
      : { staffId: staffIdOrPayload, date: dateArg };
    const response = await axios.delete(`${base_url}/hr/staff-attendance/record`, {
      params: payload,
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

export const createHoliday = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/holidays`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHolidays = async () => {
  try {
    const response = await axios.get(`${base_url}/hr/holidays`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteHoliday = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/hr/holidays?id=${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Advance Salary APIs
export const createAdvanceSalary = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/advance-salary`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getAdvanceSalaries = async (month, type) => {
  try {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (type) params.append('type', type);

    const url = params.toString()
      ? `${base_url}/hr/advance-salary?${params.toString()}`
      : `${base_url}/hr/advance-salary`;

    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateAdvanceSalary = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/hr/advance-salary?id=${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getAttendanceSummary = async (month, staffId, type) => {
  try {
    const response = await axios.get(`${base_url}/hr/attendance-summary?month=${month}&staffId=${staffId}&type=${type}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


export const getPayrollSheet = async (month, type) => {
  try {
    const response = await axios.get(`${base_url}/hr/payroll-sheet?month=${month}&type=${type}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const bulkMarkStaffAttendance = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/staff-attendance/bulk`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    // Backward-compatible fallback when backend doesn't yet expose bulk route.
    if (error?.response?.status === 404 && Array.isArray(data?.rows)) {
      const rows = data.rows.filter((r) => r?.staffId || r?.employeeId || r?.teacherId);
      if (!rows.length) {
        return { success: true, count: 0, created: 0, updated: 0, message: "No eligible staff rows to save." };
      }

      await Promise.all(
        rows.map((r) =>
          axios.post(
            `${base_url}/hr/staff-attendance`,
            {
              staffId: r.staffId,
              employeeId: r.employeeId,
              teacherId: r.teacherId,
              date: data.date,
              status: r.status || "PRESENT",
              leaveType: (String(r.status || "").toUpperCase() === "LEAVE")
                ? (String(r.leaveType || "CASUAL").toUpperCase())
                : undefined,
              notes: r.notes || "",
            },
            { withCredentials: true }
          )
        )
      );

      return {
        success: true,
        count: rows.length,
        created: rows.length,
        updated: 0,
        message: `Saved attendance for ${rows.length} staff.`,
      };
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    throw { message, status: error.response?.status || 500 };
  }
};

// HR Reports (section-specific APIs)
export const getHrLeavesReport = async (month) => {
  try {
    const response = await axios.get(`${base_url}/hr/leave-sheet`, {
      params: { month, type: "all" },
      withCredentials: true,
    });
    return response.data || [];
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHrPayrollReport = async (month) => {
  try {
    const response = await axios.get(`${base_url}/hr/payroll-sheet`, {
      params: { month, type: "all" },
      withCredentials: true,
    });
    return response.data || [];
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHrAdvanceReport = async (month) => {
  try {
    const response = await axios.get(`${base_url}/hr/advance-salary`, {
      params: { month, type: "all" },
      withCredentials: true,
    });
    return response.data || [];
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHrStaffAttendanceReport = async (date) => {
  try {
    const response = await axios.get(`${base_url}/hr/staff-attendance`, {
      params: { date, role: "all" },
      withCredentials: true,
    });
    return response.data || [];
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHrDepartmentsReport = async () => {
  try {
    const [departments, staff] = await Promise.all([
      getDepartments(),
      getAllStaff({ status: "ACTIVE" }),
    ]);

    const norm = (v) =>
      String(v || "")
        .toLowerCase()
        .replace(/\([^)]*\)/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const rows = departments.map((dept) => {
      const deptId = Number(dept.id);
      const deptNameNorm = norm(dept.name);
      const staffCount = staff.filter((s) => {
        const byDeptId =
          (s.departmentId != null && Number(s.departmentId) === deptId) ||
          (s.department?.id != null && Number(s.department.id) === deptId);
        if (byDeptId) return true;

        // Backward-compat fallback for legacy rows that may not have FK populated yet.
        const relDeptNorm = norm(s.department?.name);
        return relDeptNorm && relDeptNorm === deptNameNorm;
      }).length;
      return {
        id: dept.id,
        name: dept.name,
        hodName: dept.hod?.name || dept.headOfDepartment?.name || dept.hodName || "N/A",
        staffCount,
      };
    });

    return rows;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getMissingPayrollStaff = async (month, type) => {
  try {
    const response = await axios.get(`${base_url}/hr/payroll-missing-staff?month=${month}&type=${type}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const generatePayroll = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/payroll-generate`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const upsertPayroll = async (data) => {
  try {
    const response = await axios.post(`${base_url}/hr/payroll`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const recordPayrollPayment = async (payrollId, data) => {
  try {
    const response = await axios.post(`${base_url}/hr/payroll/${payrollId}/payment`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteAdvanceSalary = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/hr/advance-salary?id=${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ==================== FINANCE ====================

// Income
export const getFinanceIncomes = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);

    const url = params.toString()
      ? `${base_url}/finance/income?${params.toString()}`
      : `${base_url}/finance/income`;

    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createFinanceIncome = async (data) => {
  try {
    const response = await axios.post(`${base_url}/finance/income`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFinanceIncome = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/finance/income/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Expense
export const getFinanceExpenses = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.subCategory && filters.subCategory !== 'all') params.append('subCategory', filters.subCategory);
    if (filters.status) params.append('status', filters.status);

    const url = params.toString()
      ? `${base_url}/finance/expense?${params.toString()}`
      : `${base_url}/finance/expense`;

    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getFinanceReportsAnalytics = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.groupBy) params.append('groupBy', filters.groupBy);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await axios.get(`${base_url}/finance/reports/analytics${query}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createFinanceExpense = async (data) => {
  try {
    const response = await axios.post(`${base_url}/finance/expense`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFinanceExpense = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/finance/expense/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const approveFinanceExpense = async (dataOrId) => {
  try {
    const id = typeof dataOrId === "object" ? dataOrId.id : dataOrId;
    const body = typeof dataOrId === "object" && dataOrId.walletId ? { walletId: dataOrId.walletId } : {};
    const response = await axios.patch(`${base_url}/finance/expense/${id}/approve`, body, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const rejectFinanceExpense = async ({ id, rejectionReason }) => {
  try {
    const response = await axios.patch(`${base_url}/finance/expense/${id}/reject`, { rejectionReason }, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Closing
export const getFinanceClosingDashboard = async (params = {}) => {
  try {
    const searchParams = new URLSearchParams();
    if (params?.date) searchParams.append('date', params.date);
    if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.append('dateTo', params.dateTo);

    const url = searchParams.toString()
      ? `${base_url}/finance/closing/dashboard?${searchParams.toString()}`
      : `${base_url}/finance/closing/dashboard`;

    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getFinanceClosings = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.type) params.append('type', filters.type);

    const url = params.toString()
      ? `${base_url}/finance/closing?${params.toString()}`
      : `${base_url}/finance/closing`;

    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createFinanceClosing = async (data) => {
  try {
    const response = await axios.post(`${base_url}/finance/closing`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Ledger
export const getFinanceLedger = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.category && filters.category !== 'all') params.append('category', filters.category);
    if (filters.walletId && filters.walletId !== 'all') params.append('walletId', filters.walletId);
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);

    const url = params.toString()
      ? `${base_url}/finance/ledger?${params.toString()}`
      : `${base_url}/finance/ledger`;

    const response = await axios.get(url, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Categories & Sub-categories
export const getFinanceCategories = async (type) => {
  try {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    const url = params.toString() ? `${base_url}/finance/categories?${params.toString()}` : `${base_url}/finance/categories`;
    const response = await axios.get(url, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to fetch categories";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createFinanceCategory = async (data) => {
  try {
    const response = await axios.post(`${base_url}/finance/categories`, data, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to create category";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateFinanceCategory = async (id, data) => {
  try {
    const response = await axios.put(`${base_url}/finance/categories/${id}`, data, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to update category";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFinanceCategory = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/finance/categories/${id}`, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to delete category";
    throw { message, status: error.response?.status || 500 };
  }
};

export const addFinanceSubCategory = async (id, name) => {
  try {
    const response = await axios.post(`${base_url}/finance/categories/${id}/subcategories`, { name }, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to add sub-category";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateFinanceSubCategory = async (id, oldName, newName) => {
  try {
    const response = await axios.put(`${base_url}/finance/categories/${id}/subcategories`, { oldName, newName }, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to update sub-category";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFinanceSubCategory = async (id, subName) => {
  try {
    const response = await axios.delete(`${base_url}/finance/categories/${id}/subcategories/${encodeURIComponent(subName)}`, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to delete sub-category";
    throw { message, status: error.response?.status || 500 };
  }
};

// ========== CONFIGURATION ==========
// Institute Settings
export const getInstituteSettings = async () => {
  try {
    const response = await axios.get(`${base_url}/configuration/institute-settings`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateInstituteSettings = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/configuration/institute-settings`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Report Card Templates
export const getReportCardTemplates = async () => {
  try {
    const response = await axios.get(`${base_url}/configuration/report-card-templates`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createReportCardTemplate = async (data) => {
  try {
    const response = await axios.post(`${base_url}/configuration/report-card-templates`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateReportCardTemplate = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/configuration/report-card-templates/${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteReportCardTemplate = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/configuration/report-card-templates/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Finance Closing - Update and Delete
export const updateFinanceClosing = async ({ id, data }) => {
  try {
    const response = await axios.patch(`${base_url}/finance/closing/${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFinanceClosing = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/finance/closing/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};



export const getDashboardStats = async (filters) => {
  try {
    const params = new URLSearchParams();
    if (filters?.sessionId) params.append('sessionId', filters.sessionId);
    if (filters?.year) params.append('year', filters.year);
    if (filters?.month) params.append('month', filters.month);
    const response = await axios.get(`${base_url}/dashboard/stats?${params.toString()}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

const dashboardSection = (path) => async (sessionId) => {
  try {
    const params = sessionId && sessionId !== 'all' ? `?sessionId=${sessionId}` : '';
    const response = await axios.get(`${base_url}/dashboard/${path}${params}`, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getDashboardStudents = dashboardSection('students');
export const getDashboardFees = dashboardSection('fees');
export const getDashboardAttendance = dashboardSection('attendance');
export const getDashboardStaff = dashboardSection('staff');
export const getDashboardFinance = dashboardSection('finance');
export const getDashboardCharts = dashboardSection('charts');

export const getAverageTuitionByClass = async (sessionId) => {
  try {
    const params = sessionId && sessionId !== 'all' ? `?sessionId=${sessionId}` : '';
    const response = await axios.get(`${base_url}/dashboard/average-tuition${params}`, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Fee Challan Templates
export const getFeeChallanTemplates = async () => {
  try {
    const response = await axios.get(`${base_url}/fee-management/template/get/all`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to fetch fee challan templates";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getDefaultFeeChallanTemplate = async (type) => {
  try {
    const params = type ? `?type=${encodeURIComponent(type)}` : "";
    const response = await axios.get(`${base_url}/fee-management/template/get/default${params}`, {
      withCredentials: true,
    });
    return response.data || null;
  } catch (error) {
    return null;
  }
};

export const createFeeChallanTemplate = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee-management/template/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to create fee challan template";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateFeeChallanTemplate = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/fee-management/template/update?id=${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to update fee challan template";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteFeeChallanTemplate = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/fee-management/template/delete?id=${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to delete fee challan template";
    throw { message, status: error.response?.status || 500 };
  }
};

// ID Card Templates (Stubs)
export const getIDCardTemplates = async () => {
  return []; // Stubbed
};

export const createIDCardTemplate = async (data) => {
  return data; // Stubbed
};

export const updateIDCardTemplate = async (id, data) => {
  return data; // Stubbed
};

export const deleteIDCardTemplate = async (id) => {
  return true; // Stubbed
};

// Teacher ID Card Templates (Stubs)
export const getTeacherIDCardTemplates = async () => {
  return []; // Stubbed
};

export const createTeacherIDCardTemplate = async (data) => {
  return data; // Stubbed
};

export const updateTeacherIDCardTemplate = async (id, data) => {
  return data; // Stubbed
};

export const deleteTeacherIDCardTemplate = async (id) => {
  return true; // Stubbed
};
// Staff ID Card Templates
export const getStaffIDCardTemplates = async () => {
  try {
    const { data } = await axios.get(
      `${base_url}/configuration/staff-id-card-templates`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getDefaultStaffIDCardTemplate = async () => {
  try {
    const { data } = await axios.get(
      `${base_url}/configuration/staff-id-card-templates/default`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createStaffIDCardTemplate = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/configuration/staff-id-card-templates`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateStaffIDCardTemplate = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/configuration/staff-id-card-templates/${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteStaffIDCardTemplate = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/configuration/staff-id-card-templates/${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// Student ID Card Templates
export const getDefaultStudentIDCardTemplate = async () => {
  try {
    const { data } = await axios.get(
      `${base_url}/configuration/student-id-card-templates/default`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStudentIDCardTemplates = async () => {
  try {
    const { data } = await axios.get(
      `${base_url}/configuration/student-id-card-templates`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createStudentIDCardTemplate = async (payload) => {
  try {
    const { data } = await axios.post(
      `${base_url}/configuration/student-id-card-templates`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateStudentIDCardTemplate = async (id, payload) => {
  try {
    const { data } = await axios.patch(
      `${base_url}/configuration/student-id-card-templates/${id}`,
      payload,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteStudentIDCardTemplate = async (id) => {
  try {
    const { data } = await axios.delete(
      `${base_url}/configuration/student-id-card-templates/${id}`,
      {
        withCredentials: true,
      }
    );
    return data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};



// attendance generation & holiday
export const generateStudentAttendance = async (classId, sectionId, subjectId, date, sessionId, payload = {}) => {
  try {
    const params = new URLSearchParams({ attenFor: "student", date });
    if (classId) params.append("classId", classId);
    if (sectionId && sectionId !== "*") params.append("sectionId", sectionId);
    if (subjectId) params.append("subjectId", subjectId);
    if (sessionId) params.append("sessionId", sessionId);
    const response = await axios.post(
      `${base_url}/attendance/generate?${params.toString()}`,
      payload,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const generateStaffAttendance = async (date) => {
  try {
    const response = await axios.post(
      `${base_url}/attendance/generate?attenFor=teacher&date=${date}`,
      {},
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const markDateAsHoliday = async (date, title) => {
  try {
    const response = await axios.post(
      `${base_url}/hr/holidays`,
      { date, title, type: "Staff", repeatYearly: false, description: title },
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const undoGenerateAttendance = async (date) => {
  try {
    const formatted = format(date, "yyyy-MM-dd");
    const response = await axios.delete(
      `${base_url}/hr/staff-attendance?date=${formatted}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message || error.message;
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteStaffAttendanceByDate = async (date, role = 'all') => {
  try {
    const response = await axios.delete(
      `${base_url}/hr/staff-attendance/by-date?date=${date}&role=${role}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw { message, status: error.response?.status || 500 };
  }
};

export const undoMarkHoliday = async (id) => {
  try {
    const response = await axios.delete(
      `${base_url}/hr/holidays?id=${id}`,
      { withCredentials: true }
    );
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.message || error.message;
    throw { message, status: error.response?.status || 500 };
  }
};

// Per-class/section attendance skip
export const createAttendanceSkip = async (classId, sectionId, date, reason) => {
  try {
    const response = await axios.post(`${base_url}/attendance/skip`, { classId, sectionId: sectionId || null, date, reason }, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteAttendanceSkip = async (id) => {
  try {
    const response = await axios.delete(`${base_url}/attendance/skip?id=${id}`, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw { message, status: error.response?.status || 500 };
  }
};

export const getAttendanceSkips = async (classId, sectionId) => {
  try {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (sectionId) params.append('sectionId', sectionId);
    const response = await axios.get(`${base_url}/attendance/skip?${params.toString()}`, { withCredentials: true });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message;
    throw { message, status: error.response?.status || 500 };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOSTEL STUDENT LOOKUP & EXTERNAL CHALLANS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getHostelRegistrationByStudent = async (studentId) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/registrations/by-student/${studentId}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelRoomByStudent = async (studentId) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/room/by-student/${studentId}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getExternalChallansByRegistration = async (registrationId) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/external-challans/by-registration/${registrationId}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createExternalChallan = async (challanData) => {
  try {
    const { data } = await axios.post(`${base_url}/hostel/external-challans`, challanData, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateExternalChallan = async (id, challanData) => {
  try {
    const { data } = await axios.patch(`${base_url}/hostel/external-challans/${id}`, challanData, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteExternalChallan = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/hostel/external-challans/${id}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelFeePayments = async (registrationId) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/registrations/${registrationId}/payments`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createHostelFeePayment = async (registrationId, paymentData) => {
  try {
    const { data } = await axios.post(`${base_url}/hostel/registrations/${registrationId}/payments`, paymentData, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteHostelFeePayment = async (registrationId, paymentId) => {
  try {
    const { data } = await axios.delete(`${base_url}/hostel/registrations/${registrationId}/payments/${paymentId}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOSTEL CHALLANS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const getHostelChallansDedicated = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    const url = `${base_url}/hostel/challans${params.toString() ? '?' + params.toString() : ''}`;
    const { data } = await axios.get(url, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createHostelChallanDedicated = async (dto) => {
  try {
    const { data } = await axios.post(`${base_url}/hostel/challans`, dto, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateHostelChallanDedicated = async (id, dto) => {
  try {
    const { data } = await axios.patch(`${base_url}/hostel/challans/${id}`, dto, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteHostelChallanDedicated = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/hostel/challans/${id}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const printHostelChallanDedicated = async (id) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/challans/${id}/print`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelRegistrationCredit = async (registrationId) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/registrations/${registrationId}/credit`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const recordHostelPayment = async (challanId, paymentData) => {
  try {
    const { data } = await axios.post(`${base_url}/hostel/challans/${challanId}/payment`, paymentData, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelRevenue = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { data } = await axios.get(`${base_url}/hostel/revenue${query}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelReportsAnalytics = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.groupBy) params.append('groupBy', filters.groupBy);
    const query = params.toString() ? `?${params.toString()}` : '';
    const { data } = await axios.get(`${base_url}/hostel/reports/analytics${query}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const searchHostelRegistrationsDedicated = async (q) => {
  try {
    const { data } = await axios.get(`${base_url}/hostel/registrations-search`, { params: { q }, withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};


// ═══════════════════════════════════════════════════════════════════════════
// NEW FEE MANAGEMENT APIs (fee-management-redesign)
// ═══════════════════════════════════════════════════════════════════════════

// --- Installments ---

export const getStudentInstallments = async (studentId) => {
  try {
    const response = await axios.get(`${base_url}/fee/installments?studentId=${studentId}`, {
      withCredentials: true,
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const getInstallment = async (id) => {
  try {
    const response = await axios.get(`${base_url}/fee/installments/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateInstallment = async (id, data) => {
  try {
    const response = await axios.patch(`${base_url}/fee/installments/${id}`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const createInstallments = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee/installments/bulk-create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

// --- Challans ---

export const generateChallan = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee/challans/generate`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const bulkGenerateChallans = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee/challans/bulk-generate`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const generateExtraChallan = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee/challans/extra`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const bulkGenerateExtraChallans = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee-management/extra-challan/create`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

// List challans — wraps existing getFeeChallans for now; new endpoint when backend is ready
export const getFeeInstallmentChallans = async (params = {}) => {
  // TODO: switch to GET /fee/challans once the new backend endpoint is live
  return getFeeChallans(params);
};

export const getFeeInstallmentChallan = async (id) => {
  try {
    const response = await axios.get(`${base_url}/fee/challans/${id}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const voidFeeInstallmentChallan = async (id) => {
  try {
    const response = await axios.patch(`${base_url}/fee/challans/${id}/void`, {}, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const printFeeInstallmentChallan = async (id, templateId) => {
  try {
    const params = templateId ? `?templateId=${templateId}` : '';
    const response = await axios.get(`${base_url}/fee/challans/${id}/print${params}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

// --- Payments ---

export const recordFeePayment = async (data) => {
  try {
    const response = await axios.post(`${base_url}/fee/payments`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStudentCreditBalance = async (studentId) => {
  try {
    const response = await axios.get(`${base_url}/fee/student-credit/${studentId}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const getChallanReceipts = async (challanId) => {
  try {
    const response = await axios.get(`${base_url}/fee/challans/${challanId}/receipts`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const recordExtraFeePayment = async ({ id, data }) => {
  try {
    const response = await axios.post(`${base_url}/fee/challans/extra/${id}/pay`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getExtraChallans = async (params = {}) => {
  try {
    const response = await axios.get(`${base_url}/fee-management/extra-challan/get/all`, {
      params,
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const printExtraChallan = async (id) => {
  try {
    const response = await axios.get(`${base_url}/fee/challans/extra/${id}/print`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getStudentFeePaymentHistory = async (studentId) => {
  try {
    const response = await axios.get(`${base_url}/fee/payments?studentId=${studentId}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

// --- Reports ---

export const getNewFeeReportSummary = async (sessionId, type, dateFrom, dateTo) => {
  try {
    const params = new URLSearchParams();
    if (sessionId && sessionId !== 'all') params.append('sessionId', sessionId);
    if (type && type !== 'all') params.append('type', type);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await axios.get(`${base_url}/fee/reports/summary${query}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const getNewRevenueOverTime = async (sessionId) => {
  try {
    const params = sessionId && sessionId !== 'all' ? `?sessionId=${sessionId}` : '';
    const response = await axios.get(`${base_url}/fee/reports/revenue-over-time${params}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const getNewClassStats = async (sessionId) => {
  try {
    const params = sessionId && sessionId !== 'all' ? `?sessionId=${sessionId}` : '';
    const response = await axios.get(`${base_url}/fee/reports/class-stats${params}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const getNewFeeReportsAnalytics = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    if (filters.sessionId && filters.sessionId !== 'all') params.append('sessionId', filters.sessionId);
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.groupBy) params.append('groupBy', filters.groupBy);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await axios.get(`${base_url}/fee/reports/analytics${query}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHrReportsAnalytics = async (month, date) => {
  try {
    const response = await axios.get(`${base_url}/hr/reports/analytics`, {
      params: { month, date },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// --- Settings ---

export const getNewFeeSettings = async () => {
  try {
    const response = await axios.get(`${base_url}/fee/settings`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateNewFeeSettings = async (data) => {
  try {
    const response = await axios.patch(`${base_url}/fee/settings`, data, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || 'Something went wrong';
    throw { message, status: error.response?.status || 500 };
  }
};

// --- Extra Challans (Dedicated) ---

export const getExtraChallansDedicated = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    const queryString = params.toString() ? `?${params.toString()}` : '';
    try {
      const { data } = await axios.get(`${base_url}/fee/challans/extra${queryString}`, { withCredentials: true });
      return data;
    } catch (primaryErr) {
      const { data } = await axios.get(`${base_url}/fee-management/extra-challan/get/all${queryString}`, { withCredentials: true });
      return data;
    }
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateExtraChallanDedicated = async (id, dto) => {
  try {
    try {
      const { data } = await axios.patch(`${base_url}/fee/challans/extra/${id}`, dto, { withCredentials: true });
      return data;
    } catch (err) {
      const { data } = await axios.patch(`${base_url}/fee-management/extra-challan/update?id=${id}`, dto, { withCredentials: true });
      return data;
    }
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteExtraChallanDedicated = async (id) => {
  try {
    try {
      const { data } = await axios.delete(`${base_url}/fee/challans/extra/${id}`, { withCredentials: true });
      return data;
    } catch (err) {
      const { data } = await axios.delete(`${base_url}/fee-management/extra-challan/remove?id=${id}`, { withCredentials: true });
      return data;
    }
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// ==========================================
// --- Wallets / Treasury Accounts APIs ---
// ==========================================

export const getWallets = async () => {
  try {
    const { data } = await axios.get(`${base_url}/wallets`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getWalletById = async (id) => {
  try {
    const { data } = await axios.get(`${base_url}/wallets/${id}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const createWallet = async (dto) => {
  try {
    const { data } = await axios.post(`${base_url}/wallets`, dto, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateWallet = async (id, dto) => {
  try {
    const { data } = await axios.put(`${base_url}/wallets/${id}`, dto, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deleteWallet = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/wallets/${id}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const depositWalletFunds = async (dto) => {
  try {
    const { data } = await axios.post(`${base_url}/wallets/deposit`, dto, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const transferWalletFunds = async (dto) => {
  try {
    const { data } = await axios.post(`${base_url}/wallets/transfer`, dto, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getWalletHistory = async (params = {}) => {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const url = `${base_url}/wallets/history${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const { data } = await axios.get(url, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const deductPayrollFromWallet = async (dto) => {
  try {
    const { data } = await axios.post(`${base_url}/wallets/payroll-deduction`, dto, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getPayrollDeductionLogs = async (params = {}) => {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const url = `${base_url}/wallets/payroll-logs${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const { data } = await axios.get(url, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getHostelFeeLogs = async (params = {}) => {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const url = `${base_url}/wallets/hostel-logs${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const { data } = await axios.get(url, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getTuitionFeeLogs = async (params = {}) => {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const url = `${base_url}/wallets/tuition-fee-logs${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const { data } = await axios.get(url, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getFeeLogs = getTuitionFeeLogs;

export const getWalletExpenseLogs = async (params = {}) => {
  try {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    const url = `${base_url}/wallets/expense-logs${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
    const { data } = await axios.get(url, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.response?.data?.error || error.message || "Something went wrong";
    throw { message, status: error.response?.status || 500 };
  }
};

// --- Teacher Leaves & Complaints ---
export const getTeacherLeaves = async () => {
  try {
    const { data } = await axios.get(`${base_url}/teacher/my-leaves`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to fetch leaves";
    throw { message, status: error.response?.status || 500 };
  }
};

export const applyTeacherLeave = async (payload) => {
  try {
    const { data } = await axios.post(`${base_url}/teacher/apply-leave`, payload, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to apply for leave";
    throw { message, status: error.response?.status || 500 };
  }
};

export const cancelTeacherLeave = async (id) => {
  try {
    const { data } = await axios.delete(`${base_url}/teacher/cancel-leave/${id}`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to cancel leave";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getTeacherComplaints = async () => {
  try {
    const { data } = await axios.get(`${base_url}/teacher/my-complaints`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to fetch complaints";
    throw { message, status: error.response?.status || 500 };
  }
};

export const submitTeacherComplaint = async (payload) => {
  try {
    const { data } = await axios.post(`${base_url}/teacher/submit-complaint`, payload, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to submit complaint";
    throw { message, status: error.response?.status || 500 };
  }
};

export const addTeacherComplaintRemark = async (id, payload) => {
  try {
    const { data } = await axios.post(`${base_url}/teacher/complaints/${id}/remark`, payload, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to add remark";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getAssignedComplaints = async () => {
  try {
    const { data } = await axios.get(`${base_url}/teacher/assigned-complaints`, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to fetch assigned complaints";
    throw { message, status: error.response?.status || 500 };
  }
};

export const updateTeacherComplaintStatus = async (id, payload) => {
  try {
    const { data } = await axios.patch(`${base_url}/teacher/complaints/${id}/status`, payload, { withCredentials: true });
    return data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to update complaint status";
    throw { message, status: error.response?.status || 500 };
  }
};

// Activity Logs
export const getActivityLogs = async (params = {}) => {
  try {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "" && value !== "all") {
        query.append(key, value);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : "";
    const response = await axios.get(`${base_url}/configuration/activity-logs${queryString}`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to fetch activity logs";
    throw { message, status: error.response?.status || 500 };
  }
};

export const getActivityLogFilterOptions = async () => {
  try {
    const response = await axios.get(`${base_url}/configuration/activity-logs/filter-options`, {
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to fetch filter options";
    throw { message, status: error.response?.status || 500 };
  }
};

export const clearActivityLogs = async (days = 90) => {
  try {
    const response = await axios.delete(`${base_url}/configuration/activity-logs/clear`, {
      data: { days },
      withCredentials: true,
    });
    return response.data;
  } catch (error) {
    const message = error.response?.data?.message || error.message || "Failed to clear logs";
    throw { message, status: error.response?.status || 500 };
  }
};






