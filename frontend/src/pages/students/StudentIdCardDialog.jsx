import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDefaultStudentIDCardTemplate } from "../../../config/apis";
import { resolveFileUrl } from "@/lib/utils";

export const StudentIdCardDialog = ({
  open,
  onOpenChange,
  student,
  academicPath = "-",
}) => {
  const { toast } = useToast();
  const [defaultIdCardTemplate, setDefaultIdCardTemplate] = useState("");
  const [generatedIdCard, setGeneratedIdCard] = useState("");

  const generateIdCardHtml = (template, s) => {
    if (!template || !s) return "";
    let html = template;
    const logoUrl = "/logo.png";

    const replacements = {
      "{{logoUrl}}": logoUrl,
      "{{studentPhoto}}": resolveFileUrl(s.photo_url) || "https://placehold.co/150",
      "{{name}}": `${s.fName} ${s.lName || ""}`.trim(),
      "{{admissionNo}}": s.rollNumber || "",
      "{{classGroup}}": academicPath,
      "{{issueDate}}": new Date().toLocaleDateString(),
      "{{expiryDate}}": new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString(),
      "{{fatherName}}": s.fatherOrguardian || "",
      "{{phone}}": s.parentOrGuardianPhone || "",
      "{{fatherContact}}": s.parentOrGuardianPhone || "",
      "{{dob}}": s.dob ? new Date(s.dob).toLocaleDateString() : "",
      "{{address}}": s.address || "",
    };

    for (const [key, value] of Object.entries(replacements)) {
      html = html.replace(new RegExp(key, "g"), value);
    }
    return html;
  };

  useEffect(() => {
    if (open && student) {
      const fetchTemplate = async () => {
        try {
          const template = await getDefaultStudentIDCardTemplate();
          if (template && template.htmlContent) {
            setDefaultIdCardTemplate(template.htmlContent);
            setGeneratedIdCard(generateIdCardHtml(template.htmlContent, student));
          } else {
            toast({
              title: "No default template found",
              description: "Please set a default Student ID Card template in Configuration",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error(error);
        }
      };
      fetchTemplate();
    }
  }, [open, student]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white overflow-y-auto max-h-[90vh] text-black">
        <DialogHeader>
          <DialogTitle>Student ID Card</DialogTitle>
        </DialogHeader>

        {student && generatedIdCard ? (
          <div
            id="id-card-print"
            dangerouslySetInnerHTML={{ __html: generatedIdCard }}
            className="flex flex-col items-center gap-4 text-black"
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            {defaultIdCardTemplate ? "Generating card..." : "No default ID card template found. Please set one in Configuration."}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t pt-4 text-black">
          <Button onClick={() => onOpenChange(false)} variant="outline">Close</Button>
          <Button
            disabled={!generatedIdCard}
            onClick={() => {
              const el = document.getElementById("id-card-print");
              if (el) {
                const win = window.open("", "", "width=800,height=600");
                win?.document.write(`
                  <html>
                    <head>
                      <title>ID Card - ${student?.fName}</title>
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
