"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useQuery } from "convex/react"
import { ChevronLeft, ChevronRight, ArrowLeft, Share2, Volume2, Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { api } from "@/convex/_generated/api"

interface FlagDetailViewProps {
  flagKey: string
}

export function FlagDetailView({ flagKey }: FlagDetailViewProps) {
  const router = useRouter()
  const flag = useQuery(api.flags.getFlagByKey, { key: flagKey })
  const allFlags = useQuery(api.flags.getAllFlags)

  // Determine navigation (prev/next)
  const navigation = React.useMemo(() => {
    if (!allFlags || !flag) return { prev: null, next: null }
    
    // Sort allFlags by order to ensure consistent navigation
    const sortedFlags = [...allFlags].sort((a, b) => a.order - b.order)
    const currentIndex = sortedFlags.findIndex(f => f._id === flag._id)
    
    if (currentIndex === -1) return { prev: null, next: null }

    return {
      prev: currentIndex > 0 ? sortedFlags[currentIndex - 1] : null,
      next: currentIndex < sortedFlags.length - 1 ? sortedFlags[currentIndex + 1] : null
    }
  }, [allFlags, flag])

  const handleCopyLink = () => {
    const url = window.location.href
    navigator.clipboard.writeText(url)
    // Could add a toast here
  }
  
  const handlePrint = () => {
    window.print()
  }

  // Placeholder for audio
  const playAudio = () => {
    // In a real implementation, this would play an audio file
    console.log(`Playing audio for ${flag?.phonetic}`)
  }

  if (flag === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-4">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        </div>
      </div>
    )
  }

  if (flag === null) {
    return (
      <div className="container mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-2xl font-bold mb-4">Flag not found</h2>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-8 print:p-0 print:max-w-none">
      {/* Header Navigation */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" className="gap-1 pl-0 text-muted-foreground hover:text-foreground" asChild>
          <Link href="/dashboard/reference">
            <ArrowLeft className="h-4 w-4" />
            Back to Reference
          </Link>
        </Button>
        <div className="flex gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy Link</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Print Page</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-8 lg:gap-12">
        {/* Left Column: Visuals */}
        <div className="md:col-span-2 space-y-6">
          <Card className="overflow-hidden border-2 bg-muted/5 print:border-none print:shadow-none">
            <div className="aspect-square relative p-8 md:p-12 flex items-center justify-center bg-white/50 dark:bg-black/10">
              <Image
                src={flag.imagePath}
                alt={`Signal flag for ${flag.name}`}
                fill
                className="object-contain drop-shadow-lg"
                priority
                unoptimized // Using local SVG files
              />
            </div>
          </Card>
          
          <div className="bg-muted/10 rounded-lg p-5 border space-y-3 print:hidden">
             <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Color Breakdown</h3>
             <div className="flex flex-wrap gap-2">
                {flag.colors.map((color) => (
                    <Badge key={color} variant="outline" className="capitalize px-3 py-1 bg-background">
                        {color}
                    </Badge>
                ))}
             </div>
             {flag.pattern && (
                <div className="pt-2">
                    <span className="text-sm text-muted-foreground pr-2">Pattern:</span>
                    <span className="text-sm font-medium capitalize">{flag.pattern.replace('-', ' ')}</span>
                </div>
             )}
          </div>

          <div className="hidden md:flex justify-between items-center text-sm font-medium text-muted-foreground print:hidden">
            {navigation.prev ? (
                <Link href={`/dashboard/reference/flags/${navigation.prev.key}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                    <ChevronLeft className="h-4 w-4" />
                    <span>{navigation.prev.name}</span>
                </Link>
            ) : <div/>}
            
            {navigation.next ? (
                <Link href={`/dashboard/reference/flags/${navigation.next.key}`} className="flex items-center gap-1 hover:text-primary transition-colors">
                    <span>{navigation.next.name}</span>
                    <ChevronRight className="h-4 w-4" />
                </Link>
            ) : <div/>}
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="md:col-span-3 space-y-8">
           <div>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="mb-3 uppercase tracking-widest text-[10px] font-semibold text-muted-foreground">
                    {flag.type.replace('flag-', '').replace('-', ' ')}
                </Badge>
                {navigation.next || navigation.prev ? (
                    <div className="flex gap-1 md:hidden print:hidden">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={!navigation.prev} asChild={!!navigation.prev}>
                            {navigation.prev ? (
                                <Link href={`/dashboard/reference/flags/${navigation.prev.key}`}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Link>
                            ) : <ChevronLeft className="h-4 w-4" />}
                        </Button>
                         <Button variant="outline" size="icon" className="h-8 w-8" disabled={!navigation.next} asChild={!!navigation.next}>
                            {navigation.next ? (
                                <Link href={`/dashboard/reference/flags/${navigation.next.key}`}>
                                    <ChevronRight className="h-4 w-4" />
                                </Link>
                            ) : <ChevronRight className="h-4 w-4" />}
                        </Button>
                    </div>
                ): null}
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground flex items-center gap-4">
                {flag.name}
                {flag.phonetic && (
                    <button 
                        onClick={playAudio} 
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors print:hidden"
                        title={`Pronunciation: ${flag.phonetic}`}
                    >
                        <Volume2 className="h-6 w-6" />
                    </button>
                )}
              </h1>
              {flag.phonetic && (
                <p className="text-xl text-muted-foreground font-mono mt-1">/{flag.phonetic}/</p>
              )}
           </div>

           <div className="my-6 border-t" />
           
           <div className="space-y-6">
                <section>
                    <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                        Meaning
                    </h2>
                    <p className="text-2xl font-medium leading-relaxed">{flag.meaning}</p>
                </section>

                <div className="grid sm:grid-cols-2 gap-6 pt-2">
                    <section>
                         <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                            Description
                        </h2>
                        <p className="text-md leading-relaxed text-foreground/90">{flag.description}</p>
                    </section>

                    {flag.tips && (
                         <div className="bg-blue-50 dark:bg-blue-950/30 p-5 rounded-lg border border-blue-100 dark:border-blue-900/50">
                            <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wider mb-2">
                                Identification Tip
                            </h2>
                            <p className="text-blue-800 dark:text-blue-200 italic">
                                &quot;{flag.tips}&quot;
                            </p>
                        </div>
                    )}
                </div>

                {flag.difficulty && (
                     <section className="pt-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Exam Difficulty:</span>
                            <Badge variant={
                                flag.difficulty === 'beginner' ? 'default' : 
                                flag.difficulty === 'intermediate' ? 'secondary' : 'destructive'
                            }>
                                {flag.difficulty}
                            </Badge>
                        </div>
                     </section>
                )}
           </div>

           {/* Placeholder for usage context or expanded info if available in schema later */}
        </div>
      </div>
    </div>
  )
}
