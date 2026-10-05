import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { verifyStudentPublic } from "../../../config/apis";
import { resolveFileUrl } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  User,
  BookOpen,
  Calendar,
  Layers,
  ShieldCheck,
  Building2,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const StudentVerifyPage = () => {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStudentData = async () => {
    if (!id) {
      setError("No student ID specified");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await verifyStudentPublic(id);
      setStudent(data);
    } catch (err) {
      setError(err?.message || "Student record could not be verified");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [id]);

  const getStatusBadge = (status) => {
    const s = (status || "ACTIVE").toUpperCase();
    if (s === "ACTIVE") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 text-xs uppercase tracking-wider">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active Student
        </Badge>
      );
    }
    if (s === "GRADUATED" || s === "PASSED_OUT") {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-1 text-xs uppercase tracking-wider">
          <GraduationCap className="w-3.5 h-3.5 mr-1" /> Graduated
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="font-medium px-3 py-1 text-xs uppercase tracking-wider">
        <AlertCircle className="w-3.5 h-3.5 mr-1" /> {status || "Inactive"}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/50 via-slate-50 to-slate-100 py-6 px-4 sm:px-6 flex flex-col justify-between items-center text-slate-900">
      <div className="w-full max-w-md mx-auto">
        {/* College Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <img
              src="/logo.png"
              alt="Concordia College"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight font-serif uppercase">
            Concordia College
          </h1>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">
            Peshawar Campus
          </p>
          <p className="text-[11px] text-slate-500 italic mt-0.5">
            A Project of Beaconhouse
          </p>
        </div>

        {/* Verification Status Pill */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-semibold shadow-xs">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Official Student Verification</span>
          </div>
        </div>

        {/* Content Card */}
        {loading ? (
          <Card className="border border-slate-200/80 shadow-md bg-white overflow-hidden">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-slate-200 animate-pulse mb-4" />
              <div className="h-5 w-40 bg-slate-200 animate-pulse rounded mb-2" />
              <div className="h-4 w-28 bg-slate-100 animate-pulse rounded mb-6" />
              <div className="w-full space-y-3">
                <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
                <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
                <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
                <div className="h-10 bg-slate-100 animate-pulse rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ) : error || !student ? (
          <Card className="border-red-200 shadow-md bg-white overflow-hidden">
            <div className="bg-red-500 h-1.5 w-full" />
            <CardContent className="p-6 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-red-50 text-red-500 flex items-center justify-center border border-red-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-1">
                Record Not Found
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                {error || "The scanned QR code is invalid or does not match any registered student."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchStudentData}
                className="text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry Verification
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border border-slate-200/80 shadow-lg bg-white overflow-hidden">
            {/* Top decorative stripe */}
            <div className="bg-[#f29200] h-2 w-full" />

            <CardContent className="p-5 sm:p-6">
              {/* Photo & Name */}
              <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
                <div className="relative mb-3">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-[#f29200] overflow-hidden bg-slate-100 shadow-md flex items-center justify-center">
                    {student.photo_url ? (
                      <img
                        src={resolveFileUrl(student.photo_url)}
                        alt={student.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "https://placehold.co/150?text=Student";
                        }}
                      />
                    ) : (
                      <User className="w-12 h-12 text-slate-400" />
                    )}
                  </div>
                </div>

                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  {student.name}
                </h2>
                <div className="mt-1.5 mb-1">
                  {getStatusBadge(student.status)}
                </div>
              </div>

              {/* Detail Rows */}
              <div className="divide-y divide-slate-100 text-xs sm:text-sm mt-3">
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-amber-600" /> Roll Number
                  </span>
                  <span className="font-bold text-slate-900 font-mono text-sm bg-slate-100 px-2 py-0.5 rounded">
                    {student.rollNumber || "-"}
                  </span>
                </div>

                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-500 font-medium flex items-center gap-1.5">
                    <User className="w-4 h-4 text-amber-600" /> Father's Name
                  </span>
                  <span className="font-semibold text-slate-800 text-right">
                    {student.fatherName || "-"}
                  </span>
                </div>

                {student.program && (
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-600" /> Program
                    </span>
                    <span className="font-semibold text-slate-800 text-right">
                      {student.program}
                    </span>
                  </div>
                )}

                {(student.class || student.section) && (
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-amber-600" /> Class & Section
                    </span>
                    <span className="font-semibold text-slate-800 text-right">
                      {[student.class, student.section ? `Sec ${student.section}` : null]
                        .filter(Boolean)
                        .join(" - ") || "-"}
                    </span>
                  </div>
                )}

                {student.session && (
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-amber-600" /> Academic Session
                    </span>
                    <span className="font-semibold text-slate-800 text-right">
                      {student.session}
                    </span>
                  </div>
                )}
              </div>

              {/* Official campus info */}
              <div className="mt-5 pt-4 border-t border-dashed border-slate-200 text-center text-[11px] text-slate-500 leading-relaxed">
                <div className="flex items-center justify-center gap-1 font-semibold text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-amber-600" />
                  Concordia College Peshawar
                </div>
                <div>60-C University Road, University Town, Peshawar</div>
                <div>Tel: 091-5619915 | WhatsApp: 0332-8581222</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-[11px] text-slate-400">
        Concordia ERP ID Card Verification &bull; {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default StudentVerifyPage;
