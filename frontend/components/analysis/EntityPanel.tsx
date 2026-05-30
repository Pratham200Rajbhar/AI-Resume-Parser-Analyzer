'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import type { ResumeEntities } from '@/types'
import { MapPin, Mail, Phone, User, Briefcase, GraduationCap, Award, Code } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface EntityPanelProps {
  entities: ResumeEntities
}

export function EntityPanel({ entities }: EntityPanelProps) {
  const experience = entities.experience ?? []
  const education = entities.education ?? []
  const skills = entities.skills ?? []
  const certifications = entities.certifications ?? []
  const projects = entities.projects ?? []

  return (
    <Tabs defaultValue="contact">
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="contact">Contact</TabsTrigger>
        <TabsTrigger value="experience">
          Experience ({experience.length})
        </TabsTrigger>
        <TabsTrigger value="education">
          Education ({education.length})
        </TabsTrigger>
        <TabsTrigger value="skills">
          Skills ({skills.length})
        </TabsTrigger>
        <TabsTrigger value="certifications">
          Certs ({certifications.length})
        </TabsTrigger>
        <TabsTrigger value="projects">
          Projects ({projects.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="contact" className="mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entities.name && (
            <InfoRow icon={User} label="Name" value={entities.name} />
          )}
          {entities.email && (
            <InfoRow icon={Mail} label="Email" value={entities.email} />
          )}
          {entities.phone && (
            <InfoRow icon={Phone} label="Phone" value={entities.phone} />
          )}
          {entities.location && (
            <InfoRow icon={MapPin} label="Location" value={entities.location} />
          )}
        </div>
        {entities.summary && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs font-medium text-gray-500 mb-1">Summary</p>
            <p className="text-sm text-gray-700 leading-relaxed">{entities.summary}</p>
          </div>
        )}
        {!entities.name && !entities.email && !entities.phone && !entities.location && !entities.summary && (
          <p className="text-sm text-gray-400">No contact information extracted</p>
        )}
      </TabsContent>

      <TabsContent value="experience" className="mt-4">
        {experience.length === 0 ? (
          <p className="text-sm text-gray-400">No experience entries found</p>
        ) : (
          <div className="space-y-4">
            {experience.map((exp, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Briefcase className="w-4 h-4 text-indigo-500" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{exp.role}</p>
                  <p className="text-sm text-gray-600">{exp.company}</p>
                  {(exp.startDate || exp.endDate) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {exp.startDate ?? '?'} — {exp.endDate ?? 'Present'}
                      {exp.durationMonths && (
                        <span className="ml-2 text-gray-300">
                          ({Math.floor(exp.durationMonths / 12)}y {exp.durationMonths % 12}m)
                        </span>
                      )}
                    </p>
                  )}
                  {exp.description && (
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-3">
                      {exp.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="education" className="mt-4">
        {education.length === 0 ? (
          <p className="text-sm text-gray-400">No education entries found</p>
        ) : (
          <div className="space-y-4">
            {education.map((edu, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-green-500" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{edu.institution}</p>
                  {edu.degree && (
                    <p className="text-sm text-gray-600">
                      {edu.degree}
                      {edu.field ? ` in ${edu.field}` : ''}
                    </p>
                  )}
                  {edu.graduationYear && (
                    <p className="text-xs text-gray-400 mt-0.5">Class of {edu.graduationYear}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="skills" className="mt-4">
        {skills.length === 0 ? (
          <p className="text-sm text-gray-400">No skills extracted</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {skills.map((skill, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
                title={`Confidence: ${Math.round(skill.confidence * 100)}%`}
              >
                {skill.normalized}
                {skill.category && (
                  <span className="text-indigo-400">· {skill.category}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="certifications" className="mt-4">
        {certifications.length === 0 ? (
          <p className="text-sm text-gray-400">No certifications found</p>
        ) : (
          <div className="space-y-2">
            {certifications.map((cert, i) => (
              <div key={i} className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className="text-sm text-gray-700">{cert}</span>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="projects" className="mt-4">
        {projects.length === 0 ? (
          <p className="text-sm text-gray-400">No projects found</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-gray-400" />
                  <p className="text-sm font-semibold text-gray-900">{project.name}</p>
                </div>
                {project.description && (
                  <p className="text-xs text-gray-600 leading-relaxed">{project.description}</p>
                )}
                {(project.technologies?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {project.technologies?.map((tech, j) => (
                      <Badge key={j} variant="secondary" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}
