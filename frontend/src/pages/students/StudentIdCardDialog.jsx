import React, { useMemo, useState, useEffect } from "react";
import QRCode from "qrcode";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { getDefaultStudentIDCardTemplate, getStudentById } from "../../../config/apis";
import { resolveFileUrl } from "@/lib/utils";
import { StudentIdCardSkeleton } from "@/skeletons/StudentIdCardSkeleton";

export const StudentIdCardDialog = ({
  open,
  onOpenChange,
  student,
  academicPath = "-",
}) => {
  const studentId = student?.id || student?._id;

  const { data: templateData, isLoading: templateLoading } = useQuery({
    queryKey: ["defaultIdCardTemplate"],
    queryFn: getDefaultStudentIDCardTemplate,
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: fullStudentData, isLoading: studentLoading } = useQuery({
    queryKey: ["studentIdCardDetails", studentId],
    queryFn: () => getStudentById(studentId),
    enabled: open && !!studentId,
    staleTime: 60 * 1000,
  });

  const activeStudent = fullStudentData || student;
  const isLoading = open && (templateLoading || (!!studentId && studentLoading && !fullStudentData));

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");

  useEffect(() => {
    let isMounted = true;
    const targetId = activeStudent?._id || activeStudent?.id;
    if (!targetId) {
      setQrCodeDataUrl("");
      return;
    }
    const verifyUrl = `https://beams.hayatfoundation.org.pk/student/verify/${targetId}`;

    QRCode.toDataURL(verifyUrl, {
      width: 160,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) setQrCodeDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate student QR code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [activeStudent]);

  const generateIdCardHtml = (template, s, qrDataUrl) => {
    if (!template || !s) return "";
    let html = template;
    const logoUrl = "/logo.png";

    const qrImgTag = qrDataUrl
      ? `<img src="${qrDataUrl}" alt="Student QR Code" style="width: 80px; height: 80px; object-fit: contain; background: #fff; padding: 2px; border-radius: 4px;" />`
      : "";

    const replacements = {
      "{{logoUrl}}": logoUrl,
      "{{studentPhoto}}": resolveFileUrl(s.photo_url) || "https://placehold.co/150",
      "{{name}}": `${s.fName || ""} ${s.lName || ""}`.trim(),
      "{{admissionNo}}": s.rollNumber || "",
      "{{classGroup}}": academicPath,
      "{{issueDate}}": new Date().toLocaleDateString(),
      "{{expiryDate}}": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString(),
      "{{fatherName}}": s.fatherOrguardian || "",
      "{{phone}}": s.parentOrGuardianPhone || "",
      "{{fatherContact}}": s.parentOrGuardianPhone || "",
      "{{dob}}": s.dob ? new Date(s.dob).toLocaleDateString() : "",
      "{{address}}": s.address || "",
      "{{qrCode}}": qrImgTag,
      "{{barcode}}": qrImgTag,
    };

    for (const [key, value] of Object.entries(replacements)) {
      html = html.replace(new RegExp(key, "g"), value);
    }

    // Also replace legacy fake barcode div if present in stored template
    const legacyBarcodePattern = /<div style="[^"]*margin-top:\s*10px[^"]*repeating-linear-gradient[^"]*"><\/div>/gi;
    if (legacyBarcodePattern.test(html)) {
      html = html.replace(
        legacyBarcodePattern,
        `<div style="margin-top: 10px; display: flex; justify-content: center; align-items: center; width: 100%;">${qrImgTag}</div>`
      );
    }

    return html;
  };

  const templateHtml = templateData?.htmlContent || "";
  const generatedIdCard = useMemo(() => {
    if (!templateHtml || !activeStudent) return "";
    return generateIdCardHtml(templateHtml, activeStudent, qrCodeDataUrl);
  }, [templateHtml, activeStudent, academicPath, qrCodeDataUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white overflow-y-auto max-h-[90vh] text-black">
        <DialogHeader>
          <DialogTitle>Student ID Card</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <StudentIdCardSkeleton />
        ) : generatedIdCard ? (
          <div
            id="id-card-print"
            dangerouslySetInnerHTML={{ __html: generatedIdCard }}
            className="flex flex-col items-center gap-4 text-black"
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No default ID card template found. Please set one in Configuration.
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4 text-black">
          <Button onClick={() => onOpenChange(false)} variant="outline">Close</Button>
          <Button
            disabled={isLoading || !generatedIdCard}
            onClick={() => {
              const el = document.getElementById("id-card-print");
              if (el) {
                const win = window.open("", "", "width=800,height=600");
                win?.document.write(`
                  <html>
                    <head>
                      <title>ID Card - ${activeStudent?.fName || ""}</title>
                      <style>
                        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 20px; display: flex; flex-direction: column; align-items: center; }
                        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                      </style>
                    </head>
                    <body>
                      ${el.innerHTML}
                      <script>
                        setTimeout(() => {
                          window.print();
                          window.close();
                        }, 500);
                      </script>
                    </body>
                  </html>
                `);
                win?.document.close();
              }
            }}
          >
            <FileText className="w-4 h-4 mr-2" /> Print ID Card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentIdCardDialog;
